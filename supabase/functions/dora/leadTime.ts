// @ts-nocheck
import { fetchPRPage } from "./github.ts";
import { computeDurationHours, parseQualifyingBranch } from "./branch.ts";
import { getBranchCreatedAtMap } from "./db.ts";

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

export async function handleLeadTime(repo: string, token: string, limit: number, since?: Date, schema = "portal") {
  const prs = await fetchMergedPRs(repo, token, limit, since);

  const qualifyingPRs = prs
    .map((pr) => ({ pr, branch: parseQualifyingBranch(pr.head?.ref) }))
    .filter(({ branch }) => branch?.type === "feat");

  const branchCreatedAtByName = await getBranchCreatedAtMap(
    schema,
    repo,
    qualifyingPRs.map(({ pr }) => pr.head.ref),
  );

  const results = [];

  for (const { pr, branch } of qualifyingPRs) {
    const branchCreatedAt = branchCreatedAtByName.get(pr.head.ref);
    if (!branchCreatedAt) continue;

    const lead_hours = computeDurationHours(branchCreatedAt, pr.merged_at);

    results.push({
      linear_issue_id: branch.linearId,
      branch: pr.head.ref,
      branch_created_at: branchCreatedAt,
      pr: {
        number: pr.number,
        title: pr.title,
        merged_at: pr.merged_at,
        url: pr.html_url,
      },
      deployed_at: pr.merged_at,
      lead_hours,
    });
  }

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