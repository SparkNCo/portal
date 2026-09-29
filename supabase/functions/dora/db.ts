// @ts-nocheck
import { supabase } from "../client.ts";

// Idempotent (ON CONFLICT DO NOTHING): redeliveries never overwrite the
// first-seen timestamp. `version` counts branches per Linear issue (a new
// branch after an abandoned one gets max+1; the first gets 1).
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

// MTTR "incident start" proxy: closed_date of the last feat shipped before this
// fix (assumed to be what it fixes). Null if none.
export async function getLastFeatClosedBefore(
  schema: string,
  repo: string,
  beforeIso: string,
): Promise<string | null> {
  const { data, error } = await supabase.schema(schema)
    .from("dora_branch_events")
    .select("closed_date")
    .eq("repo", repo)
    .eq("branch_type", "feat")
    .not("closed_date", "is", null)
    .lt("closed_date", beforeIso)
    .order("closed_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up last feat closed_date: ${error.message}`);
  }

  return data?.closed_date ?? null;
}

// Total branches ever recorded of a given type for this repo — used by
// Defect Escape Rate, which is a ratio over all known fix/feat branches, not
// just ones inside a lookback window.
export async function getBranchTypeCount(
  schema: string,
  repo: string,
  branchType: string,
): Promise<number> {
  const { count, error } = await supabase.schema(schema)
    .from("dora_branch_events")
    .select("*", { count: "exact", head: true })
    .eq("repo", repo)
    .eq("branch_type", branchType);

  if (error) {
    throw new Error(`Failed to count ${branchType} branch events: ${error.message}`);
  }

  return count ?? 0;
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
