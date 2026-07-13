// @ts-nocheck
import { supabase } from "../client.ts";

// Idempotent: ON CONFLICT (repo, branch_name) DO NOTHING, so redelivered
// webhook events or repeated sync passes never overwrite the first-seen
// creation timestamp or produce duplicate rows.
export async function upsertBranchCreatedEvent(
  schema: string,
  repo: string,
  branchName: string,
  linearIssueId: string,
  branchType: string,
  branchCreatedAt: string,
) {
  const { error } = await supabase.schema(schema)
    .from("dora_branch_events")
    .upsert(
      {
        repo,
        branch_name: branchName,
        linear_issue_id: linearIssueId,
        branch_type: branchType,
        branch_created_at: branchCreatedAt,
      },
      { onConflict: "repo,branch_name", ignoreDuplicates: true },
    );

  if (error) {
    throw new Error(`Failed to upsert branch created event: ${error.message}`);
  }
}

export async function getBranchCreatedAtMap(
  schema: string,
  repo: string,
  branchNames: string[],
): Promise<Map<string, string>> {
  if (!branchNames.length) return new Map();

  const { data, error } = await supabase.schema(schema)
    .from("dora_branch_events")
    .select("branch_name, branch_created_at")
    .eq("repo", repo)
    .in("branch_name", branchNames);

  if (error) {
    throw new Error(`Failed to fetch branch created events: ${error.message}`);
  }

  return new Map((data ?? []).map((row) => [row.branch_name, row.branch_created_at]));
}
