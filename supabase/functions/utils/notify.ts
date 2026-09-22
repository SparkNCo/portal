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

// One row per thing that happened (see
// 20260922120000_split_notifications_into_events.sql) — every recipient's
// notification for the same call points at this same event instead of each
// carrying its own copy of action/object/preview/link.
async function insertEvent(schema: string, fields: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.schema(schema)
    .from("events")
    .insert(fields)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

// Re-points the recipient's existing unread notification for this same
// issue at the new event, or inserts a new notification row if they don't
// have one yet — one unread notification per (user, issue) even though
// every question/upload/link on that issue gets its own event in the log.
async function upsertNotificationForEvent(
  schema: string,
  userId: string,
  eventId: string,
  objectType: string,
  issueId: string | undefined,
): Promise<void> {
  if (issueId) {
    const { data: existing, error: existingError } = await supabase.schema(schema)
      .from("notifications")
      .select("id, events!inner(object_type, issue_id)")
      .eq("user_id", userId)
      .eq("read", false)
      .eq("events.object_type", objectType)
      .eq("events.issue_id", issueId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    if (existing) {
      const { error: updateError } = await supabase.schema(schema)
        .from("notifications")
        .update({ event_id: eventId, created_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (updateError) throw new Error(updateError.message);
      return;
    }
  }

  const { error: insertError } = await supabase.schema(schema)
    .from("notifications")
    .insert({ user_id: userId, event_id: eventId, read: false });
  if (insertError) throw new Error(insertError.message);
}

// Fans a project-level event (decision requested/answered, demo uploaded,
// design resource added) out to everyone assigned to that project — the
// customer, every developer/stakeholder in portal.assignments, and every
// admin (admins aren't tied to one project via assignments, but they see
// every customer's chats/build pages via their role, so they should hear
// about this too) — minus whoever triggered it.
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

    // Independent of each other — fire together instead of one round trip
    // after another. This function runs in the background (see
    // EdgeRuntime.waitUntil at each call site) so it's not blocking the
    // user's save either way, but there's no reason to make it slower than
    // it needs to be.
    const [assignmentsResult, adminsResult, actorResult] = await Promise.all([
      supabase.schema(schema).from("assignments").select("user_id").eq("customer_id", customerUserId),
      supabase.schema(schema).from("users").select("id").eq("role", "admin"),
      supabase.schema(schema).from("users").select("id").eq("email", actorEmail).maybeSingle(),
    ]);
    if (assignmentsResult.error) throw new Error(assignmentsResult.error.message);
    if (adminsResult.error) throw new Error(adminsResult.error.message);

    const assignments = assignmentsResult.data;
    const admins = adminsResult.data;
    const actor = actorResult.data;

    const recipientIds = new Set<string>();
    recipientIds.add(customerUserId);
    (assignments ?? []).forEach((a) => a.user_id && recipientIds.add(a.user_id));
    (admins ?? []).forEach((a) => a.id && recipientIds.add(a.id));
    if (actor?.id) recipientIds.delete(actor.id);

    if (recipientIds.size === 0) return;

    const eventId = await insertEvent(schema, {
      actor_user_id: actor?.id ?? null,
      actor_email: actorEmail,
      action,
      object_type: objectType,
      object_id: objectId,
      preview: preview ?? null,
      issue_code: issueCode ?? null,
      issue_id: issueId ?? null,
      link,
    });

    await Promise.all(
      Array.from(recipientIds).map((user_id) =>
        upsertNotificationForEvent(schema, user_id, eventId, objectType, issueId),
      ),
    );
  } catch (err) {
    console.error("[notifyProject] failed (non-fatal):", err);
  }
}
