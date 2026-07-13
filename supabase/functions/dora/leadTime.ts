// @ts-nocheck
import { getQualifyingBranchEvents, computeDurationHours } from "./lifecycle.ts";

export async function handleLeadTime(repo: string, token: string, limit: number, since?: Date, schema = "portal") {
  const events = await getQualifyingBranchEvents(repo, token, limit, since, "feat", schema);

  const results = events.map((event) => ({
    linear_issue_id: event.linear_issue_id,
    branch: event.branch,
    branch_created_at: event.branch_created_at,
    dev_start_source: event.dev_start_source,
    pr: event.pr,
    deployed_at: event.deployed_at,
    lead_hours: computeDurationHours(event.branch_created_at, event.dev_completed_at),
  }));

  const avg =
    results.length > 0
      ? Number.parseFloat(
          (results.reduce((sum, r) => sum + r.lead_hours, 0) / results.length).toFixed(2)
        )
      : null;

  return {
    repo,
    metric: "lead_time_for_changes",
    avg_lead_hours: avg,
    unit: "hours",
    sample_size: results.length,
    results,
  };
}
