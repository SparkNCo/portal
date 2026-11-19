// @ts-nocheck
// POST /storage/share { document_id, emails: string[], user_id } — anyone
// with access to the document (or an admin) shares it by email:
//   - an email of a portal user gives that user access (and a notification);
//   - any other email gets the document by email: attached, or as a 7-day
//     download link when it's too big to attach.
// Returns who got access, who was emailed, who already had access and which
// emails failed.
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { supabase } from "../client.ts";
import { sendEmail } from "../lib/mailer.ts";
import { escapeIlike } from "../utils/slug.ts";
import { notifyUsers, resolveDocumentsLink } from "../utils/notify.ts";
import { extractPathFromUrl } from "./downloadDocument.ts";
import { grantAccess, hasDocumentAccess, initiativeUserIds, jsonResponse, liveDocument } from "./access.ts";

// Attachments above this go as a download link: mail providers reject big
// attachments (Resend's cap is 40 MB for the whole message, Gmail's 25 MB).
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const LINK_EXPIRY_SECONDS = 7 * 24 * 60 * 60;
const MAX_EMAILS = 20;

const ShareSchema = z.object({
  document_id: z.coerce.number().int().positive(),
  user_id: z.string().uuid(),
  emails: z.array(z.string().trim().toLowerCase().email().max(254)).min(1).max(MAX_EMAILS),
});

const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function storagePaths(link: string): string[] {
  const path = extractPathFromUrl(link);
  if (!path) return [];
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // keep the raw path
  }
  return [...new Set([decoded, path])];
}

// The file for an external recipient: its bytes (base64) when small enough
// to attach, otherwise a time-limited download link.
async function fileForEmail(link: string): Promise<{ attachment?: string; url?: string } | null> {
  for (const path of storagePaths(link)) {
    const { data, error } = await supabase.storage.from("documents_bucket").download(path);
    if (error || !data) continue;
    if (data.size <= MAX_ATTACHMENT_BYTES) {
      const bytes = new Uint8Array(await data.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { attachment: btoa(binary) };
    }
    const { data: signed } = await supabase.storage.from("documents_bucket").createSignedUrl(path, LINK_EXPIRY_SECONDS, {
      download: true,
    });
    if (signed?.signedUrl) return { url: signed.signedUrl };
  }
  return null;
}

function externalEmailHtml(sharerName: string, fileName: string, url?: string) {
  const body = url
    ? `The file is too large to attach, so here's a link to download it (it works for 7 days):</p><p style="margin:16px 0"><a href="${esc(url)}" style="display:inline-block;background:#f78035;color:#111111;padding:11px 22px;font-weight:700;text-decoration:none">Download ${esc(fileName)}</a>`
    : `It's attached to this email.`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#1a1a1a;max-width:560px">
  <p><strong>${esc(sharerName)}</strong> shared <strong>${esc(fileName)}</strong> with you through the Spark &amp; Co portal.</p>
  <p>${body}</p>
  <p style="color:#6b6b6b;font-size:13px">Spark &amp; Co</p>
</div>`;
}

export async function shareDocument(req: Request, schema: string) {
  try {
    const parsed = ShareSchema.safeParse(await req.json());
    if (!parsed.success) return jsonResponse({ error: "Invalid request", details: parsed.error.flatten() }, 400);
    const { document_id, user_id } = parsed.data;
    const emails = [...new Set(parsed.data.emails)];

    if (!(await hasDocumentAccess(schema, user_id, document_id))) return jsonResponse({ error: "No access" }, 403);
    const document = await liveDocument(schema, document_id, "id, file_name, link, project_slug, initiative_wide");
    if (!document) return jsonResponse({ error: "Document not found" }, 404);

    const { data: sharer } = await supabase.schema(schema)
      .from("users")
      .select("email, firstName, lastName, userName")
      .eq("id", user_id)
      .maybeSingle();
    const sharerName =
      [sharer?.firstName, sharer?.lastName].filter(Boolean).join(" ").trim() || sharer?.userName || sharer?.email || "Someone";

    // Portal users among the emails (emails are stored with mixed casing).
    const { data: users, error: usersError } = await supabase.schema(schema)
      .from("users")
      .select("id, email")
      .or(emails.map((e) => `email.ilike.${escapeIlike(e)}`).join(","));
    if (usersError) return jsonResponse({ error: usersError.message }, 500);
    const userByEmail = new Map((users ?? []).filter((u) => u.email).map((u) => [u.email.toLowerCase(), u]));

    const internal = emails.filter((e) => userByEmail.has(e));
    const external = emails.filter((e) => !userByEmail.has(e));

    // 1. Portal users: access (skipping who already has it) + a notification.
    // People on the initiative already have an initiative_wide document.
    const onInitiative = new Set(document.initiative_wide ? await initiativeUserIds(schema, document.project_slug) : []);
    const granted = await grantAccess(
      schema,
      document_id,
      internal.map((e) => userByEmail.get(e).id).filter((id) => !onInitiative.has(id)),
    );
    const grantedSet = new Set(granted);
    const sharedWith = internal.filter((e) => grantedSet.has(userByEmail.get(e).id));
    const alreadyHadAccess = internal.filter((e) => !grantedSet.has(userByEmail.get(e).id));

    if (granted.length > 0 && document.project_slug && typeof EdgeRuntime !== "undefined") {
      const { data: customer } = await supabase.schema(schema)
        .from("customers")
        .select('"clientName"')
        .ilike("linear_slug", escapeIlike(document.project_slug))
        .maybeSingle();
      if (customer?.clientName) {
        EdgeRuntime.waitUntil(notifyUsers({
          userIds: granted,
          actorEmail: sharer?.email ?? "",
          action: "document_shared",
          objectType: "document",
          objectId: String(document_id),
          objectTitle: document.file_name,
          link: resolveDocumentsLink(customer.clientName.toLowerCase()),
        }));
      }
    }

    // 2. Everyone else: the file by email, one message each (recipients
    // don't see each other).
    const emailed: string[] = [];
    const failed: string[] = [];
    if (external.length > 0) {
      const file = await fileForEmail(document.link ?? "");
      if (!file) {
        failed.push(...external);
      } else {
        for (const to of external) {
          const { error } = await sendEmail({
            to,
            subject: `${sharerName} shared "${document.file_name}" with you`,
            html: externalEmailHtml(sharerName, document.file_name, file.url),
            ...(file.attachment && { attachments: [{ filename: document.file_name, content: file.attachment }] }),
          });
          if (error) {
            console.error("[shareDocument] email failed:", to, error);
            failed.push(to);
          } else {
            emailed.push(to);
          }
        }
      }
    }

    return jsonResponse({
      success: failed.length === 0,
      shared_with: sharedWith,
      emailed,
      already_had_access: alreadyHadAccess,
      failed,
    });
  } catch (error) {
    console.error("[shareDocument]", error);
    return jsonResponse({ error: error.message }, 500);
  }
}
