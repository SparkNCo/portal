// @ts-nocheck
import { getCIStatus, fetchPRPage } from "./github.ts";

const INCIDENT_PATTERNS = [
  /caused by\s*:\s*(SPA-[\w-]+)/gi,
  /^fix:\s*(SPA-[\w-]+)/gim,
];

function extractIncidents(text: string): string[] {
  const found = new Set<string>();
  for (const pattern of INCIDENT_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      found.add(m[1].toUpperCase());
    }
  }
  return [...found];
}

async function fetchLatestPRs(repo: string, token: string, limit: number) {
  const prs = await fetchPRPage(repo, token, 1, Math.min(limit, 100));

  const results = [];
  for (const pr of prs) {
    if (!pr.merged_at) continue;

    const sha = pr.merge_commit_sha || pr.head?.sha;
    const bodyText = pr.body ?? "";
    const titleText = pr.title ?? "";
    const incidents = extractIncidents(`${titleText}\n${bodyText}`);
    const ciState = sha ? await getCIStatus(repo, sha, token) : "unknown";
    console.log("PR", pr);

    results.push({
      pr_number: pr.number,
      title: pr.title,
      description: bodyText || null,
      merged_at: pr.merged_at,
      merged_by: pr.merged_by?.login ?? null,
      url: pr.html_url,
      ci_status: ciState,
      merge_successful: ciState === "success",
      caused_by: incidents,
    });

    if (results.length >= limit) break;
  }

  return results;
}

export async function handleLatest(repo: string, token: string, limit: number) {
  const prs = await fetchLatestPRs(repo, token, limit);

  const incident_counts: Record<string, number> = {};
  for (const pr of prs) {
    for (const id of pr.caused_by) {
      incident_counts[id] = (incident_counts[id] ?? 0) + 1;
    }
  }

  return {
    repo,
    metric: "latest_prs",
    total: prs.length,
    incident_counts,
    prs,
  };
}
