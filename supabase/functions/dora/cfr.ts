// @ts-nocheck
import { fetchPRPage, fetchPRCommits, isHotfix } from "./github.ts";
import { parseQualifyingBranch } from "./branch.ts";

const FIX_SPA_RE = /^fix:\s*SPA-[\w-]+/i;

// Additive, not a replacement: title/labels/commits (isHotfix, FIX_SPA_RE) still
// catch signals a "fix/" PR title alone can't — reverts, rollbacks, manual
// "hotfix" labels, or a fix made mid-stream inside a feat/ PR. A fix/-prefixed
// PR title is just one more way to reach the same "this was reactive work"
// conclusion, so it counts even if the rest of the title never says "fix".
export function isCFRHotfix(pr: any, commits: any[]): boolean {
  return (
    isHotfix(pr, commits) ||
    FIX_SPA_RE.test((pr.title ?? "").trim()) ||
    parseQualifyingBranch(pr.title)?.type === "fix"
  );
}

async function fetchMergedPRs(repo: string, token: string, limit: number) {
  const raw: any[] = [];
  let page = 1;
  const perPage = 50;

  while (raw.length < limit) {
    const prs = await fetchPRPage(repo, token, page, perPage);
    if (!prs.length) break;

    for (const pr of prs) {
      if (!pr.merged_at) continue;
      raw.push(pr);
      if (raw.length >= limit) break;
    }

    if (prs.length < perPage || raw.length >= limit) break;
    page++;
  }

  return raw;
}

export async function handleCFR(repo: string, token: string, limit: number) {
  const raw = await fetchMergedPRs(repo, token, limit);
  console.log(`🔍 CFR: fetched ${raw.length} merged PRs`, raw.map((pr) => `#${pr.number} "${pr.title}" merged=${pr.merged_at}`));

  const commitsByPR = new Map<number, any[]>();
  await Promise.all(
    raw.map(async (pr) => {
      commitsByPR.set(pr.number, await fetchPRCommits(repo, token, pr.number));
    }),
  );

  const chronological = [...raw].reverse();

  let totalNonFix = 0;
  let failedDeployments = 0;

  for (let i = 0; i < chronological.length; i++) {
    const current = chronological[i];
    if (isCFRHotfix(current, commitsByPR.get(current.number) ?? [])) continue;

    totalNonFix++;

    const next = chronological[i + 1];
    if (next && isCFRHotfix(next, commitsByPR.get(next.number) ?? [])) {
      console.log(`💥 CFR: PR#${current.number} followed by hotfix PR#${next.number} → counted as failed deployment`);
      failedDeployments++;
    }
  }

  console.log(`📊 CFR result: totalNonFix=${totalNonFix} failedDeployments=${failedDeployments}`);

  const cfr =
    totalNonFix > 0
      ? Number.parseFloat(((failedDeployments / totalNonFix) * 100).toFixed(2))
      : 0;

  return {
    repo,
    metric: "change_failure_rate",
    total_non_fix_deployments: totalNonFix,
    failed_deployments: failedDeployments,
    change_failure_rate: cfr,
    unit: "%",
  };
}
