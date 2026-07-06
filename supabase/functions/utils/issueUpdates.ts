// Tracks a single "has unseen update" flag per issue (portal.issue_updates).
// Not per-user: any developer's edit flips it to unseen for everyone, and
// any user opening the issue flips it back to seen.
function restHeaders(extra: Record<string, string> = {}) {
  return {
    "Content-Type": "application/json",
    apikey: Deno.env.get("SERVICE_SECRET_KEY")!,
    Authorization: `Bearer ${Deno.env.get("SERVICE_SECRET_KEY")!}`,
    "Content-Profile": "portal",
    ...extra,
  };
}

export async function markIssueUpdated(issueId: string, updatedBy: string): Promise<void> {
  const supabaseUrl = Deno.env.get("PROJECT_URL")!;

  try {
    await fetch(`${supabaseUrl}/rest/v1/issue_updates?on_conflict=issue_id`, {
      method: "POST",
      headers: restHeaders({ Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({
        issue_id: issueId,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
        seen: false,
      }),
    });
  } catch (err) {
    console.error("[markIssueUpdated] failed (non-fatal):", err);
  }
}

export async function markIssueSeen(issueId: string): Promise<void> {
  const supabaseUrl = Deno.env.get("PROJECT_URL")!;

  try {
    await fetch(`${supabaseUrl}/rest/v1/issue_updates?issue_id=eq.${issueId}`, {
      method: "PATCH",
      headers: restHeaders(),
      body: JSON.stringify({ seen: true }),
    });
  } catch (err) {
    console.error("[markIssueSeen] failed (non-fatal):", err);
  }
}
