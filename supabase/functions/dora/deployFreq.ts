// @ts-nocheck
import { fetchPRPage, isCommitOnMain } from "./github.ts";
import { parseQualifyingBranch } from "./branch.ts";

// Deployment = the squash commit for a PR whose title is a qualifying feat/fix
// title is reachable on main. No CI-status gate: per the DORA flow spec,
// deployment is approximated purely by commit presence on main, not by a
// separate CI/deployment source.
// isHotfix is intentionally NOT used to exclude merges here — it flags anything
// whose title/commits start with "fix/"/"fix:" as an excluded hotfix, which
// would wrongly zero out every qualifying fix/ deployment now that fix/ PRs
// are first-class qualifying work with identical lifecycle rules to feat/.
async function fetchDeployments(repo: string, token: string, limit: number, since?: Date) {
  const deployments = [];
  let page = 1;
  const perPage = 20;

  while (deployments.length < limit) {
    const prs = await fetchPRPage(repo, token, page, perPage);
    if (!prs.length) break;

    let done = false;
    for (const pr of prs) {
      if (!pr.merged_at) continue;
      if (since && new Date(pr.merged_at) < since) {
        console.log(`⏩ deployFreq: PR#${pr.number} "${pr.title}" skipped (before since cutoff)`);
        continue;
      }

      const branch = parseQualifyingBranch(pr.title);
      if (!branch) {
        console.log(`⏩ deployFreq: PR#${pr.number} "${pr.title}" doesn't qualify, skipping`);
        continue;
      }

      const sha = pr.merge_commit_sha;
      if (!sha) {
        console.warn(`⚠️ deployFreq: PR#${pr.number} has no merge_commit_sha, skipping`);
        continue;
      }

      const onMain = await isCommitOnMain(repo, token, sha);
      if (!onMain) {
        console.log(`⏩ deployFreq: PR#${pr.number} merge commit not (yet) reachable on main, skipping`);
        continue;
      }

      deployments.push({
        pr_number: pr.number,
        title: pr.title,
        merged_at: pr.merged_at,
        merged_by: pr.merged_by?.login ?? null,
        linear_issue_id: branch.linearId,
        branch_type: branch.type,
        branch: pr.head.ref,
        labels: pr.labels?.map((l: any) => l.name.toLowerCase()) ?? [],
        url: pr.html_url,
      });

      if (deployments.length >= limit) { done = true; break; }
    }

    if (done || prs.length < perPage) break;
    page++;
  }

  return deployments;
}

export async function handleDeployFreq(
  repo: string,
  token: string,
  limit: number,
  since?: Date,
) {
  const deployments = await fetchDeployments(repo, token, limit, since);

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
