// @ts-nocheck
import { fetchPRPage } from "./github.ts";

function isFixPR(pr: any): boolean {
  const title = (pr.title ?? "").toLowerCase().trim();
  return /^fix\s*\//.test(title);
}

function extractIssueNumber(branchName: string): string | null {
  if (!branchName) return null;
  const match = branchName.match(/^(\d+)-/);
  return match ? match[1] : null;
}

async function fetchIssue(repo: string, token: string, issueNumber: string) {
  const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchMergedPRs(repo: string, token: string, limit: number, since?: Date): Promise<any[]> {
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

export async function handleIssueResolutionTime(repo: string, token: string, limit: number, since?: Date) {
  const prs = await fetchMergedPRs(repo, token, limit, since);

  const results = [];

  for (const pr of prs) {
    if (!isFixPR(pr)) continue;

    const branchName = pr.head?.ref;
    const issueNumber = extractIssueNumber(branchName);
    if (!issueNumber) continue;

    const issue = await fetchIssue(repo, token, issueNumber);
    if (!issue || !issue.created_at) continue;

    const resolution_hours = Number.parseFloat(
      ((new Date(pr.merged_at).getTime() - new Date(issue.created_at).getTime()) / 3_600_000).toFixed(2)
    );

    results.push({
      issue: {
        number: issue.number,
        title: issue.title,
        created_at: issue.created_at,
      },
      pr: {
        number: pr.number,
        title: pr.title,
        merged_at: pr.merged_at,
        url: pr.html_url,
      },
      resolution_hours,
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