// @ts-nocheck
import { supabase } from "../client.ts";

// Idempotent: ON CONFLICT (repo, branch_name) DO NOTHING, so redelivered
// webhook events or repeated sync passes never overwrite the first-seen
// creation timestamp or produce duplicate rows.
//
// version tracks re-attempts of the same Linear issue across separate
// branches (e.g. the first branch was abandoned and a new one opened for the
// same issue): each new branch_name for a linear_issue_id already seen gets
// one more than the highest version recorded for that linear_issue_id so
// far; the first branch for an issue gets version 1 (the column default).
export async function upsertBranchCreatedEvent(
  schema: string,
  repo: string,
  branchName: string,
  linearIssueId: string,
  branchType: string,
  branchCreatedAt: string,
) {
  const { data: highestVersion, error: versionError } = await supabase.schema(schema)
    .from("dora_branch_events")
    .select("version")
    .eq("repo", repo)
    .eq("linear_issue_id", linearIssueId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionError) {
    throw new Error(`Failed to look up existing branch event version: ${versionError.message}`);
  }

  const version = (highestVersion?.version ?? 0) + 1;

  const { error } = await supabase.schema(schema)
    .from("dora_branch_events")
    .upsert(
      {
        repo,
        branch_name: branchName,
        linear_issue_id: linearIssueId,
        branch_type: branchType,
        branch_created_at: branchCreatedAt,
        version,
      },
      { onConflict: "repo,branch_name", ignoreDuplicates: true },
    );

  if (error) {
    throw new Error(`Failed to upsert branch created event: ${error.message}`);
  }
}

// Records when the PR for an already-captured branch was merged. A no-op if
// the branch's creation was never recorded (nothing to attach the close date
// to) — matches zero rows rather than erroring.
export async function updateBranchClosedDate(
  schema: string,
  repo: string,
  branchName: string,
  closedDate: string,
) {
  const { error } = await supabase.schema(schema)
    .from("dora_branch_events")
    .update({ closed_date: closedDate })
    .eq("repo", repo)
    .eq("branch_name", branchName);

  if (error) {
    throw new Error(`Failed to update branch closed date: ${error.message}`);
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
