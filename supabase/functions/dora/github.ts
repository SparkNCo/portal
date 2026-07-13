// @ts-nocheck

export const ERROR_SIGNALS = ["revert", "hotfix", "rollback", "bugfix", "fix/", "fix:"];

export function parseRepo(repoUrl: string): string {
  const match = /github\.com\/([^/]+\/[^/]+?)(?:\.git)?(?:\/.*)?$/.exec(repoUrl);
  if (match) return match[1];
  if (/^[\w.-]+\/[\w.-]+$/.test(repoUrl)) return repoUrl;
  throw new Error(`Cannot parse repo from: ${repoUrl}`);
}

export async function fetchPRCommits(repo: string, token: string, prNumber: number): Promise<any[]> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/pulls/${prNumber}/commits?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (!res.ok) {
    console.warn(`⚠️ fetchPRCommits PR#${prNumber}: HTTP ${res.status}`);
    return [];
  }
  const commits = await res.json();
  console.log(`📝 PR#${prNumber} commits (${commits.length}):`, commits.map((c: any) => c.commit?.message?.split("\n")[0]));
  return commits;
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
  console.log(`📄 fetchPRPage: page=${page} url=${url}`);
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

export async function fetchCommit(repo: string, token: string, sha: string): Promise<any | null> {
  const res = await fetch(`https://api.github.com/repos/${repo}/commits/${sha}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) return null;
  return res.json();
}

// Pure core: a squash merge always lands as exactly one brand-new commit whose
// SHA doesn't match any of the PR's original commits. A regular merge commit has
// two parents; a rebase merge reuses/chains the original (rebased) commit SHAs.
// Passing in the merge commit's own parents avoids a network call in tests.
export function isSquashMerge(mergeCommitSha: string, mergeCommitParents: string[], prCommitShas: string[]): boolean {
  if (mergeCommitParents.length !== 1) return false;
  return !prCommitShas.includes(mergeCommitSha);
}

export async function isSquashMergeForPR(repo: string, token: string, pr: any, commits: any[]): Promise<boolean> {
  const sha = pr.merge_commit_sha;
  if (!sha) return false;

  const mergeCommit = await fetchCommit(repo, token, sha);
  if (!mergeCommit) return false;

  const parents = (mergeCommit.parents ?? []).map((p: any) => p.sha);
  const prCommitShas = commits.map((c) => c.sha);
  return isSquashMerge(sha, parents, prCommitShas);
}

// Pure core: GitHub's compare API reports how `sha` relates to `main`.
// "identical" (same commit) or "behind" (main has since moved past it, but it's
// still an ancestor) both mean the commit is reachable from main.
export function isReachableStatus(compareStatus: string): boolean {
  return compareStatus === "identical" || compareStatus === "behind";
}

export async function isCommitOnMain(repo: string, token: string, sha: string): Promise<boolean> {
  const res = await fetch(`https://api.github.com/repos/${repo}/compare/main...${sha}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) return false;
  const data = await res.json();
  return isReachableStatus(data.status);
}

export async function fetchRepoEvents(repo: string, token: string, page: number, perPage: number): Promise<any[]> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/events?per_page=${perPage}&page=${page}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (!res.ok) {
    console.warn(`⚠️ fetchRepoEvents page=${page}: HTTP ${res.status}`);
    return [];
  }
  return res.json();
}

// Pure core: approximates "when did work start" from a PR's own commit
// history when no live-captured branch_created_at is available (no webhook,
// or the branch predates it). Uses author date (when the change was actually
// written) rather than committer date (which shifts on rebase/amend).
export function getEarliestCommitDate(commits: any[]): string | null {
  const timestamps = commits
    .map((c) => c.commit?.author?.date)
    .filter(Boolean)
    .map((d) => new Date(d).getTime());

  if (!timestamps.length) return null;
  return new Date(Math.min(...timestamps)).toISOString();
}

export function isHotfix(pr: any, commits: any[] = []): boolean {
  const titleLower = (pr.title ?? "").toLowerCase().trim();
  const labelNames: string[] = pr.labels?.map((l: any) => l.name.toLowerCase()) ?? [];

  if (ERROR_SIGNALS.some(
    (kw) => titleLower.startsWith(kw) || labelNames.some((l) => l.includes(kw)),
  )) {
    console.log(`🔥 PR#${pr.number} "${pr.title}" → hotfix via TITLE/LABEL`);
    return true;
  }

  const fixCommit = commits.find((commit) => {
    const msg = (commit.commit?.message ?? "").toLowerCase().trim();
    return ERROR_SIGNALS.some((kw) => msg.startsWith(kw));
  });

  if (fixCommit) {
    console.log(`🔥 PR#${pr.number} "${pr.title}" → hotfix via COMMIT: "${fixCommit.commit?.message?.split("\n")[0]}"`);
    return true;
  }

  console.log(`✅ PR#${pr.number} "${pr.title}" → normal deployment`);
  return false;
}
