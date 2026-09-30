// @ts-nocheck
import { supabase } from "../client.ts";
import { resolveCustomerUserIdBySlug } from "./slug.ts";

// Bug-labeled issues live on /bugs, everything else on /build.
export function resolveIssueDashboardLink(slug: string, issueType?: string | null): string {
  return issueType === "bug" ? `/${slug}/bugs` : `/${slug}/build`;
}

// Document-request notifications link to the Documents page.
export function resolveDocumentsLink(slug: string): string {
  return `/${slug}/documents`;
}

// One event row per occurrence; each recipient's notification points at it.
async function insertEvent(schema: string, fields: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.schema(schema)
    .from("events")
    .insert(fields)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

// Keeps one unread notification per (user, issue): re-points an existing
// unread one at the new event, or inserts a new row.
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

type NotificationFields = {
  actorEmail: string;
  action: string;
  objectType: string;
  objectId: string;
  link: string;
  preview?: string;
  issueCode?: string;
  issueId?: string;
  // Label for objects without an issue_code (e.g. document requests); see
  // formatObject in NotificationBell.tsx.
  objectTitle?: string;
};

// Creates the event and points each recipient's notification at it.
async function notifyRecipients(
  schema: string,
  recipientIds: Set<string>,
  actorId: string | null,
  fields: NotificationFields,
): Promise<void> {
  const { actorEmail, action, objectType, objectId, link, preview, issueCode, issueId, objectTitle } = fields;
  if (recipientIds.size === 0) return;

  const eventId = await insertEvent(schema, {
    actor_user_id: actorId,
    actor_email: actorEmail,
    action,
    object_type: objectType,
    object_id: objectId,
    preview: preview ?? null,
    issue_code: issueCode ?? null,
    issue_id: issueId ?? null,
    object_title: objectTitle ?? null,
    link,
  });

  await Promise.all(
    Array.from(recipientIds).map((user_id) =>
      upsertNotificationForEvent(schema, user_id, eventId, objectType, issueId),
    ),
  );
}

// Notifies the customer, assigned developers/stakeholders, and all admins —
// minus the actor. Best-effort: errors are logged, never thrown.
export async function notifyProject(params: NotificationFields & { slug: string }): Promise<void> {
  const schema = "portal";
  const { slug, actorEmail } = params;

  try {
    const customerUserId = await resolveCustomerUserIdBySlug(schema, slug);
    if (!customerUserId) return;

    // Independent lookups — run in parallel.
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

    await notifyRecipients(schema, recipientIds, actor?.id ?? null, params);
  } catch (err) {
    console.error("[notifyProject] failed (non-fatal):", err);
  }
}

// The initiative's customer plus the stakeholders assigned to it (the
// client side of a project) — developers in the same `assignments` rows are
// left out.
async function resolveClientSideUserIds(schema: string, slug: string): Promise<string[]> {
  const customerUserId = await resolveCustomerUserIdBySlug(schema, slug);
  if (!customerUserId) return [];

  const { data: assignments, error: assignmentsError } = await supabase.schema(schema)
    .from("assignments")
    .select("user_id")
    .eq("customer_id", customerUserId);
  if (assignmentsError) throw new Error(assignmentsError.message);

  const assignedIds = (assignments ?? []).map((a) => a.user_id).filter(Boolean);
  if (assignedIds.length === 0) return [customerUserId];

  const { data: stakeholders, error: stakeholdersError } = await supabase.schema(schema)
    .from("users")
    .select("id")
    .in("id", assignedIds)
    .eq("role", "stakeholder");
  if (stakeholdersError) throw new Error(stakeholdersError.message);

  return [customerUserId, ...(stakeholders ?? []).map((s) => s.id)];
}

// Notifies an explicit list of users — plus every admin when `includeAdmins`,
// and the customer + assigned stakeholders of `includeClientOf` (a slug) —
// minus the actor. For events that concern specific people rather than the
// whole project, e.g. feedback on a demo notifying its uploader.
// Best-effort: errors are logged, never thrown.
export async function notifyUsers(
  params: NotificationFields & {
    userIds: (string | null | undefined)[];
    includeAdmins?: boolean;
    includeClientOf?: string;
  },
): Promise<void> {
  const schema = "portal";
  const { userIds, includeAdmins, includeClientOf, actorEmail } = params;

  try {
    const [adminsResult, actorResult, clientSideIds] = await Promise.all([
      includeAdmins
        ? supabase.schema(schema).from("users").select("id").eq("role", "admin")
        : Promise.resolve({ data: [], error: null }),
      supabase.schema(schema).from("users").select("id").eq("email", actorEmail).maybeSingle(),
      includeClientOf ? resolveClientSideUserIds(schema, includeClientOf) : Promise.resolve([]),
    ]);
    if (adminsResult.error) throw new Error(adminsResult.error.message);
    const actor = actorResult.data;

    const recipientIds = new Set<string>();
    userIds.forEach((id) => id && recipientIds.add(id));
    clientSideIds.forEach((id) => recipientIds.add(id));
    (adminsResult.data ?? []).forEach((a) => a.id && recipientIds.add(a.id));
    if (actor?.id) recipientIds.delete(actor.id);

    await notifyRecipients(schema, recipientIds, actor?.id ?? null, params);
  } catch (err) {
    console.error("[notifyUsers] failed (non-fatal):", err);
  }
}
