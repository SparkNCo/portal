// portal.issue_updates tracks who/when an issue was last changed (Tests,
// Decisions, Design, Demo, or an issue edit). portal.issue_views tracks each
// user's own last-viewed timestamp per issue, so "has an unseen update" is
// computed per-user by comparing the two (see use-issue-update-badge.ts).
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

export async function markIssueViewed(issueId: string, userId: string): Promise<void> {
  const supabaseUrl = Deno.env.get("PROJECT_URL")!;

  try {
    await fetch(`${supabaseUrl}/rest/v1/issue_views?on_conflict=issue_id,user_id`, {
      method: "POST",
      headers: restHeaders({ Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({
        issue_id: issueId,
        user_id: userId,
        viewed_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error("[markIssueViewed] failed (non-fatal):", err);
  }
}
