// @ts-nocheck
import { getQualifyingBranchEvents, computeDurationHours } from "./lifecycle.ts";

export async function handleIssueResolutionTime(repo: string, token: string, limit: number, since?: Date, schema = "portal") {
  const events = await getQualifyingBranchEvents(repo, token, limit, since, "fix", schema);

  const results = events.map((event) => ({
    linear_issue_id: event.linear_issue_id,
    branch: event.branch,
    branch_created_at: event.branch_created_at,
    dev_start_source: event.dev_start_source,
    pr: event.pr,
    deployed_at: event.deployed_at,
    resolution_hours: computeDurationHours(event.branch_created_at, event.dev_completed_at),
  }));

  const avg =
    results.length > 0
      ? Number.parseFloat(
          (results.reduce((sum, r) => sum + r.resolution_hours, 0) / results.length).toFixed(2)
        )
      : null;

  return {
    repo,
    metric: "issue_resolution_time",
    unit: "hours",
    average_resolution_hours: avg,
    sample_size: results.length,
    results,
  };
}
