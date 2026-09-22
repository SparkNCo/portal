// @ts-nocheck
import { supabase } from "../client.ts";
import { resolveCustomerUserIdBySlug } from "./slug.ts";

// Bugs and everything else live on different dashboards (see
// components/sidebar.tsx's "Bugs"/"Build" nav items) — a decision/demo/
// design notification for a bug-labeled issue should land on /bugs, not
// /build, or the linked issue won't be there to find.
export function resolveIssueDashboardLink(slug: string, issueType?: string | null): string {
  return issueType === "bug" ? `/${slug}/bugs` : `/${slug}/build`;
}

// Refreshes the existing unread notification for (user, object_type, issue)
// in place, or inserts a new one — see idx_notifications_unread_issue_dedupe.
// PostgREST's upsert can't target a partial unique index (it only infers
// non-partial ones from a plain column list), so this is the explicit
// equivalent: one unread row per issue per user, refreshed as more
// questions/uploads/links land on the same ticket instead of piling up.
async function upsertUnreadNotification(
  schema: string,
  userId: string,
  issueId: string | undefined,
  fields: Record<string, unknown>,
): Promise<void> {
  if (issueId) {
    const { data: existing, error: existingError } = await supabase.schema(schema)
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("object_type", fields.object_type)
      .eq("issue_id", issueId)
      .is("read_at", null)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    if (existing) {
      const { error: updateError } = await supabase.schema(schema)
        .from("notifications")
        .update({ ...fields, created_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (updateError) throw new Error(updateError.message);
      return;
    }
  }

  const { error: insertError } = await supabase.schema(schema)
    .from("notifications")
    .insert({ user_id: userId, ...fields });
  if (insertError) throw new Error(insertError.message);
}

// Fans a project-level event (decision requested/answered, demo uploaded,
// design resource added) out to everyone assigned to that project — the
// customer plus every developer/stakeholder in portal.assignments — minus
// whoever triggered it.
//
// Best-effort: a failure here is logged and swallowed, same as
// markIssueUpdated — a broken notification shouldn't fail the decision/demo/
// design mutation it's attached to.
export async function notifyProject(params: {
  slug: string;
  actorEmail: string;
  action: string;
  objectType: string;
  objectId: string;
  link: string;
  preview?: string;
  issueCode?: string;
  issueId?: string;
}): Promise<void> {
  const schema = "portal";
  const { slug, actorEmail, action, objectType, objectId, link, preview, issueCode, issueId } = params;

  try {
    const customerUserId = await resolveCustomerUserIdBySlug(schema, slug);
    if (!customerUserId) return;

    const { data: assignments, error: assignmentsError } = await supabase.schema(schema)
      .from("assignments")
      .select("user_id")
      .eq("customer_id", customerUserId);
    if (assignmentsError) throw new Error(assignmentsError.message);

    const { data: actor } = await supabase.schema(schema)
      .from("users")
      .select("id")
      .eq("email", actorEmail)
      .maybeSingle();

    const recipientIds = new Set<string>();
    recipientIds.add(customerUserId);
    (assignments ?? []).forEach((a) => a.user_id && recipientIds.add(a.user_id));
    if (actor?.id) recipientIds.delete(actor.id);

    if (recipientIds.size === 0) return;

    const fields = {
      actor_user_id: actor?.id ?? null,
      actor_email: actorEmail,
      action,
      object_type: objectType,
      object_id: objectId,
      preview: preview ?? null,
      issue_code: issueCode ?? null,
      issue_id: issueId ?? null,
      link,
    };

    for (const user_id of recipientIds) {
      await upsertUnreadNotification(schema, user_id, issueId, fields);
    }
  } catch (err) {
    console.error("[notifyProject] failed (non-fatal):", err);
  }
}
