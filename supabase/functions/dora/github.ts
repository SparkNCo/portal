// @ts-nocheck

export const ERROR_SIGNALS = ["revert", "hotfix", "rollback", "bugfix"];

export function parseRepo(repoUrl: string): string {
  const match = /github\.com\/([^/]+\/[^/]+?)(?:\.git)?(?:\/.*)?$/.exec(repoUrl);
  if (match) return match[1];
  if (/^[\w.-]+\/[\w.-]+$/.test(repoUrl)) return repoUrl;
  throw new Error(`Cannot parse repo from: ${repoUrl}`);
}

export async function getCIStatus(repo: string, sha: string, token: string): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/commits/${sha}/status`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    },
  );
  if (!res.ok) return "unknown";
  const data = await res.json();
  return data.state;
}

export async function fetchPRPage(repo: string, token: string, page: number, perPage: number): Promise<any[]> {
  const url = `https://api.github.com/repos/${repo}/pulls?state=closed&base=main&per_page=${perPage}&page=${page}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${body}`);
  }
  return res.json();
}

export function linkedIssueNumbers(pr: any): number[] {
  const body = pr.body ?? "";
  const matches = [...body.matchAll(/(?:closes?|fixes?|resolves?)\s+#(\d+)/gi)];
  return matches.map((m) => Number.parseInt(m[1], 10));
}

export async function fetchIssue(repo: string, token: string, issueNumber: number): Promise<any | null> {
  const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) return null;
  return res.json();
}

export function isHotfix(pr: any): boolean {
  const titleLower = (pr.title ?? "").toLowerCase().trim();
  const labelNames: string[] = pr.labels?.map((l: any) => l.name.toLowerCase()) ?? [];
  return ERROR_SIGNALS.some(
    (kw) => titleLower.startsWith(kw) || labelNames.some((l) => l.includes(kw)),
  );
}
