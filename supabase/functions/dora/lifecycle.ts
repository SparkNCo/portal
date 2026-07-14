// @ts-nocheck
import { fetchPRPage, fetchPRCommits, isSquashMergeForPR, isCommitOnMain, getEarliestCommitDate } from "./github.ts";
import { parseQualifyingBranch, QualifyingBranchType } from "./branch.ts";
import { getBranchCreatedAtMap, updateBranchClosedDate } from "./db.ts";

export { computeDurationHours } from "./branch.ts";

export type DevStartSource = "recorded" | "first_commit_fallback";

export interface BranchLifecycleEvent {
  linear_issue_id: string;
  branch: string;
  branch_type: QualifyingBranchType;
  branch_created_at: string;
  dev_start_source: DevStartSource;
  dev_completed_at: string;
  deployed_at: string | null;
  pr: { number: number; title: string; merged_at: string; url: string };
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

// Pure core: recorded branch_created_at wins when present; otherwise falls
// back to the earliest commit date on the PR, so a branch is never silently
// excluded just because nothing was there to witness its creation live.
function resolveDevStart(
  branch: string,
  branchCreatedAtByName: Map<string, string>,
  commits: any[],
): { branchCreatedAt: string; source: DevStartSource } | null {
  const recorded = branchCreatedAtByName.get(branch);
  if (recorded) return { branchCreatedAt: recorded, source: "recorded" };

  const fallback = getEarliestCommitDate(commits);
  if (fallback) return { branchCreatedAt: fallback, source: "first_commit_fallback" };

  return null;
}

// Joins already-fetched merged PRs with recorded branch-creation events for
// branches of the given qualifying type, producing the three DORA lifecycle
// timestamps per Linear issue: dev start, dev completion (squash merge), and
// production deployment (squash commit reachable on main).
//
// dev start prefers the recorded branch_created_at (webhook or events-poll
// capture); when that's missing it falls back to the earliest commit date on
// the PR, so a branch is never silently excluded just because nothing was
// there to witness its creation live.
//
// Qualification (feat/fix + Linear id) and the branch_created_at lookup key
// both come from the PR title, not pr.head.ref — PRs are opened staging→main,
// so pr.head.ref is always "staging" and carries no branch identity. The
// original working branch is created with the same name that later becomes
// the PR title (e.g. "feat/SPA-123-add-login"), so the title is what actually
// identifies it.
//
// `getCommits`/`isSquashed`/`isOnMain` are injected so this join logic is
// testable without hitting the network.
export async function joinBranchEvents(
  prs: any[],
  branchType: QualifyingBranchType,
  branchCreatedAtByName: Map<string, string>,
  getCommits: (pr: any) => Promise<any[]> | any[],
  isSquashed: (pr: any, commits: any[]) => Promise<boolean> | boolean,
  isOnMain: (pr: any) => Promise<boolean> | boolean,
): Promise<BranchLifecycleEvent[]> {
  const qualifyingPRs = prs
    .map((pr) => ({ pr, branch: parseQualifyingBranch(pr.title) }))
    .filter(({ branch }) => branch?.type === branchType);

  const results: BranchLifecycleEvent[] = [];

  for (const { pr, branch } of qualifyingPRs) {
    const commits = await getCommits(pr);

    const devStart = resolveDevStart(pr.title, branchCreatedAtByName, commits);
    if (!devStart) {
      console.log(`⏩ lifecycle: "${pr.title}" has no recorded branch_created_at and no commits to fall back on, skipping`);
      continue;
    }

    const squashed = await isSquashed(pr, commits);
    if (!squashed) {
      console.log(`⏩ lifecycle: PR#${pr.number} "${pr.title}" has no detectable squash-merge signal, skipping`);
      continue;
    }

    const onMain = pr.merge_commit_sha ? await isOnMain(pr) : false;
    const deployed_at = onMain ? pr.merged_at : null;

    results.push({
      linear_issue_id: branch.linearId,
      branch: pr.title,
      branch_type: branch.type,
      branch_created_at: devStart.branchCreatedAt,
      dev_start_source: devStart.source,
      dev_completed_at: pr.merged_at,
      deployed_at,
      pr: {
        number: pr.number,
        title: pr.title,
        merged_at: pr.merged_at,
        url: pr.html_url,
      },
    });
  }

  return results;
}

export async function getQualifyingBranchEvents(
  repo: string,
  token: string,
  limit: number,
  since: Date | undefined,
  branchType: QualifyingBranchType,
  schema = "portal",
): Promise<BranchLifecycleEvent[]> {
  const prs = await fetchMergedPRs(repo, token, limit, since);

  const qualifyingPRs = prs
    .map((pr) => ({ pr, branch: parseQualifyingBranch(pr.title) }))
    .filter(({ branch }) => branch?.type === branchType);

  const qualifyingRefs = qualifyingPRs.map(({ pr }) => pr.title);

  const branchCreatedAtByName = await getBranchCreatedAtMap(schema, repo, qualifyingRefs);

  // Best-effort: records the PR's merge date on its branch's dora_branch_events
  // row now that it's known. Never blocks the metrics computation below.
  await Promise.all(
    qualifyingPRs.map(({ pr }) =>
      updateBranchClosedDate(schema, repo, pr.title, pr.merged_at).catch((error) =>
        console.error(`⚠️ getQualifyingBranchEvents: failed to record closed_date for "${pr.title}":`, error.message),
      ),
    ),
  );

  const commitsCache = new Map<number, any[]>();
  const getCommits = async (pr: any) => {
    if (!commitsCache.has(pr.number)) {
      commitsCache.set(pr.number, await fetchPRCommits(repo, token, pr.number));
    }
    return commitsCache.get(pr.number)!;
  };

  return joinBranchEvents(
    prs,
    branchType,
    branchCreatedAtByName,
    getCommits,
    (pr, commits) => isSquashMergeForPR(repo, token, pr, commits),
    (pr) => isCommitOnMain(repo, token, pr.merge_commit_sha),
  );
}
