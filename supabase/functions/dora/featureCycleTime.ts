// @ts-nocheck
import { getQualifyingBranchEvents, computeDurationHours } from "./lifecycle.ts";

// SPA-384 phase 2: "Feature Cycle Time" per the SDLC metrics spec — average
// (feat branch closed - feat branch created). This is the exact same join as
// Lead Time today (branch_created_at -> merge, for `feat` branches) since
// Lead Time hasn't been redefined to "staging->main merge time" yet (that's
// a separate, later change) — the two will diverge once that happens, but
// for now they intentionally report the same number under different names.
export async function handleFeatureCycleTime(repo: string, token: string, limit: number, since?: Date, schema = "portal") {
  const events = await getQualifyingBranchEvents(repo, token, limit, since, "feat", schema);

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
    metric: "feature_cycle_time",
    avg_cycle_hours: avg,
    unit: "hours",
    sample_size: results.length,
    results,
  };
}
