// @ts-nocheck

import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { deleteDocumentVectors } from "../lib/vector.ts";
import { extractPathFromUrl } from "./downloadDocument.ts";
import {
  DeleteDocumentSchema,
  DeleteDocumentResponseSchema,
} from "./zod.ts";

// Deletes a deleted document's file from documents_bucket, unless another
// document row still points at the same file.
async function removeDocumentFile(link: string, schema: string) {
  try {
    const path = extractPathFromUrl(link);
    if (!path) return;

    const { count } = await supabase.schema(schema)
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("link", link);
    if (count) return;

    // The public URL may be percent-encoded (names with spaces etc.); missing
    // paths are ignored, so try both spellings.
    let decoded = path;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      // keep the raw path
    }
    const { error } = await supabase.storage
      .from("documents_bucket")
      .remove(Array.from(new Set([path, decoded])));
    if (error) console.error("[deleteDocument] file removal failed (non-fatal):", error.message);
  } catch (err) {
    console.error("[deleteDocument] file removal failed (non-fatal):", err);
  }
}

export async function deleteDocument(req: Request, schema: string) {
  try {
    const body = await req.json();

    const parsedBody = DeleteDocumentSchema.safeParse(body);

    if (!parsedBody.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request body",
          details: parsedBody.error.flatten(),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { document_id, user_id } = parsedBody.data;

    // 1. CHECK OWNER PERMISSION (admins bypass this)
    const { data: userData } = await supabase.schema(schema)
      .from("users")
      .select("role")
      .eq("id", user_id)
      .maybeSingle();
    const isAdmin = userData?.role === "admin";

    if (!isAdmin) {
      const { data: permissionData, error: permissionError } = await supabase.schema(schema)
        .from("document_permissions")
        .select("permission")
        .eq("user_id", user_id)
        .eq("document_id", document_id)
        .single();

      if (permissionError || !permissionData) {
        return new Response(JSON.stringify({ error: "No access" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (permissionData.permission !== "owner") {
        return new Response(
          JSON.stringify({ error: "Only the owner can delete this document" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // 2. DELETE DOCUMENT
    const { data: deleted, error } = await supabase.schema(schema)
      .from("documents")
      .delete()
      .eq("id", document_id)
      .select("project_slug, link")
      .maybeSingle();

    if (error) {
      console.error("[deleteDocument]", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Remove the file too, or it stays in the bucket forever. Best-effort —
    // the document is already gone either way.
    if (deleted?.link) {
      await removeDocumentFile(deleted.link, schema);
    }

    // Best-effort: a leftover vector is harmless.
    if (deleted?.project_slug && typeof EdgeRuntime !== "undefined") {
      EdgeRuntime.waitUntil(deleteDocumentVectors(deleted.project_slug, [document_id]));
    }

    // RESPONSE
    const responsePayload = { success: true, document_id };

    const parsedOutput = DeleteDocumentResponseSchema.safeParse(responsePayload);

    if (!parsedOutput.success) {
      console.error(
        "[deleteDocument Response Validation Error]",
        parsedOutput.error.flatten(),
      );
      return new Response(
        JSON.stringify({ error: "Invalid response format" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify(parsedOutput.data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[deleteDocument]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
