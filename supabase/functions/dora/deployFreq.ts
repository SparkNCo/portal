// @ts-nocheck
import { getCIStatus, fetchPRPage, isHotfix } from "./github.ts";

async function fetchDeployments(repo: string, token: string, limit: number) {
  const merges = [];
  let page = 1;
  const perPage = 20;

  while (merges.length < limit) {
    const prs = await fetchPRPage(repo, token, page, perPage);
    if (!prs.length) break;

    for (const pr of prs) {
      if (!pr.merged_at) continue;
      if (isHotfix(pr)) continue;

      const sha = pr.merge_commit_sha || pr.head?.sha;
      if (!sha) continue;

      const ciState = await getCIStatus(repo, sha, token);
      if (ciState !== "success") continue;

      merges.push({
        pr_number: pr.number,
        title: pr.title,
        merged_at: pr.merged_at,
        merged_by: pr.merged_by?.login ?? null,
        ci_status: ciState,
        labels: pr.labels?.map((l: any) => l.name.toLowerCase()) ?? [],
        url: pr.html_url,
      });

      if (merges.length >= limit) break;
    }

    if (prs.length < perPage) break;
    page++;
  }

  return merges;
}

export async function handleDeployFreq(
  repo: string,
  token: string,
  limit: number,
) {
  const deployments = await fetchDeployments(repo, token, limit);

  const now = new Date();
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  let deployments_last_30_days = 0;
  let deployments_last_90_days = 0;

  for (const d of deployments) {
    const mergedDate = new Date(d.merged_at);

    if (mergedDate >= last30) deployments_last_30_days++;
    if (mergedDate >= last90) deployments_last_90_days++;
  }

  return {
    repo,
    metric: "deploy_frequency",
    total_deployments: deployments.length,
    deployments_last_30_days,
    deployments_last_90_days,
    deployments,
  };
}
