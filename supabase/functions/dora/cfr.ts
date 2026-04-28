// @ts-nocheck
import { fetchPRPage, isHotfix } from "./github.ts";

const FIX_SPA_RE = /^fix:\s*SPA-[\w-]+/i;

function isCFRHotfix(pr: any): boolean {
  return isHotfix(pr) || FIX_SPA_RE.test((pr.title ?? "").trim());
}

async function fetchMergedPRs(repo: string, token: string, limit: number, since?: Date) {
  const raw: any[] = [];
  let page = 1;
  const perPage = 50;

  while (raw.length < limit) {
    const prs = await fetchPRPage(repo, token, page, perPage);
    if (!prs.length) break;

    let reachedCutoff = false;
    for (const pr of prs) {
      if (!pr.merged_at) continue;
      if (since && new Date(pr.merged_at) < since) { reachedCutoff = true; continue; }
      raw.push(pr);
      if (raw.length >= limit) break;
    }

    if (reachedCutoff || prs.length < perPage || raw.length >= limit) break;
    page++;
  }

  return raw;
}

export async function handleCFR(repo: string, token: string, limit: number, since?: Date) {
  const raw = await fetchMergedPRs(repo, token, limit, since);
  const chronological = [...raw].reverse();

  let totalNonFix = 0;
  let failedDeployments = 0;

  for (let i = 0; i < chronological.length; i++) {
    const current = chronological[i];
    if (isCFRHotfix(current)) continue;

    totalNonFix++;

    const next = chronological[i + 1];
    if (next && isCFRHotfix(next)) {
      failedDeployments++;
    }
  }

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
