// @ts-nocheck
import { getQualifyingBranchEvents, computeDurationHours } from "./lifecycle.ts";
import { getLastFeatClosedBefore } from "./db.ts";

// Unlike Lead Time (dev_start → dev_completed_at on the same branch), MTTR
// measures how long the system was actually broken: from the last feat
// deployed to main before this fix (assumed to be what introduced the bug)
// to the fix's own merge. A fix with no prior feat deployment on record
// (e.g. the very first fix in the repo) has nothing to measure from and is
// excluded, rather than falling back to the fix's own dev time.
export async function handleIssueResolutionTime(repo: string, token: string, limit: number, since?: Date, schema = "portal") {
  const events = await getQualifyingBranchEvents(repo, token, limit, since, "fix", schema);

  const results: any[] = [];
  for (const event of events) {
    const incidentStart = await getLastFeatClosedBefore(schema, repo, event.dev_completed_at);
    if (!incidentStart) {
      console.log(`⏩ mttr: no feat deployed before "${event.branch}" (${event.pr.url}), skipping — nothing to measure recovery from`);
      continue;
    }

    results.push({
      linear_issue_id: event.linear_issue_id,
      branch: event.branch,
      incident_start: incidentStart,
      pr: event.pr,
      deployed_at: event.deployed_at,
      resolution_hours: computeDurationHours(incidentStart, event.dev_completed_at),
    });
  }

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
