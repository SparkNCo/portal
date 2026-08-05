// @ts-nocheck
import { getBranchTypeCount } from "./db.ts";

// SPA-384 phase 2: Defect Escape Rate = total fix branches / (total fix +
// total feat branches) for this repo. Unlike the other new metrics, this
// doesn't touch GitHub at all — `dora_branch_events` already has every
// branch this repo has ever recorded, so it's a straight count query, and
// the result is always the full-history total rather than something that
// needs merging across cron runs.
export async function handleDefectEscapeRate(repo: string, schema = "portal") {
  const [totalFeat, totalFix] = await Promise.all([
    getBranchTypeCount(schema, repo, "feat"),
    getBranchTypeCount(schema, repo, "fix"),
  ]);

  const total = totalFeat + totalFix;
  const rate = total > 0 ? Number.parseFloat(((totalFix / total) * 100).toFixed(2)) : null;

  return {
    repo,
    metric: "defect_escape_rate",
    unit: "%",
    total_feat: totalFeat,
    total_fix: totalFix,
    defect_escape_rate: rate,
  };
}
