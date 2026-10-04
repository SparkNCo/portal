// @ts-nocheck
import { supabase } from "../client.ts";

// Who requested a ticket in the portal (see the issue_requests migration).
// Shown in the ticket header as "Requested by <name> on <date>".

const SCHEMA = "portal";

function displayName(user: { firstName?: string | null; lastName?: string | null; userName?: string | null } | null, email: string) {
  const full = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  return full || user?.userName || email;
}

// Best-effort: a failure here never blocks creating the ticket.
export async function recordIssueRequest(issueId: string | undefined, email: string | undefined): Promise<void> {
  if (!issueId || !email) return;
  try {
    const { data: user } = await supabase
      .schema(SCHEMA)
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    const { error } = await supabase
      .schema(SCHEMA)
      .from("issue_requests")
      .upsert({ issue_id: issueId, requested_by: user?.id ?? null, requested_by_email: email });
    if (error) throw error;
  } catch (err) {
    console.error("[issueRequests] could not record requester (non-fatal):", err);
  }
}

// Adds `requestedBy` to each issue: { name, email } when it was requested in
// the portal, null when it was created in Linear. Leaves issues untouched if
// the lookup fails.
export async function attachRequesters<T extends { id: string }>(issues: T[]): Promise<(T & { requestedBy?: { name: string; email: string } | null })[]> {
  if (issues.length === 0) return issues;
  try {
    const { data: rows, error } = await supabase
      .schema(SCHEMA)
      .from("issue_requests")
      .select("issue_id, requested_by_email, users:requested_by (firstName, lastName, userName)")
      .in("issue_id", issues.map((i) => i.id));
    if (error) throw error;
    const byIssue = new Map(
      (rows ?? []).map((r) => [
        r.issue_id,
        { name: displayName(r.users, r.requested_by_email), email: r.requested_by_email },
      ]),
    );
    return issues.map((i) => ({ ...i, requestedBy: byIssue.get(i.id) ?? null }));
  } catch (err) {
    console.error("[issueRequests] could not load requesters (non-fatal):", err);
    return issues;
  }
}
