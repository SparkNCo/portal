// @ts-nocheck
import { getQualifyingBranchEvents, computeDurationHours } from "./lifecycle.ts";

// SPA-384 phase 2: "Fix Cycle Time" per the SDLC metrics spec — average
// (fix branch closed - fix branch created). Unlike MTTR (which measures from
// the last feat shipped before the fix, i.e. how long the system was
// actually broken), this measures the fix's own dev time — branch creation
// to its own merge. Note: this re-fetches the same qualifying `fix` PRs that
// mttr.ts already fetches for this repo, so it roughly doubles the GitHub
// API calls spent on fix-branch PRs per run — acceptable for now, but worth
// sharing a single fetch between the two if rate limits become an issue.
export async function handleFixCycleTime(repo: string, token: string, limit: number, since?: Date, schema = "portal") {
  const events = await getQualifyingBranchEvents(repo, token, limit, since, "fix", schema);

  const results = events.map((event) => ({
    linear_issue_id: event.linear_issue_id,
    branch: event.branch,
    branch_created_at: event.branch_created_at,
    dev_start_source: event.dev_start_source,
    pr: event.pr,
    deployed_at: event.deployed_at,
    cycle_hours: computeDurationHours(event.branch_created_at, event.dev_completed_at),
  }));

  const avg =
    results.length > 0
      ? Number.parseFloat(
          (results.reduce((sum, r) => sum + r.cycle_hours, 0) / results.length).toFixed(2)
        )
      : null;

  return {
    repo,
    metric: "fix_cycle_time",
    avg_cycle_hours: avg,
    unit: "hours",
    sample_size: results.length,
    results,
  };
}
