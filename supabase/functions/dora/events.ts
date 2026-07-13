// @ts-nocheck
import { fetchRepoEvents } from "./github.ts";
import { parseQualifyingBranch } from "./branch.ts";
import { upsertBranchCreatedEvent } from "./db.ts";

// GitHub's repo events feed only retains the most recent ~300 events / 90
// days, whichever comes first — this endpoint has no further pages beyond that.
const MAX_PAGES = 3;
const PER_PAGE = 100;

// Pure core: extracts real branch-creation timestamps (as logged by GitHub
// itself, not an approximation) from a page of repo events, for branches
// that qualify (feat/fix with a parseable Linear id).
export function extractBranchCreateEvents(events: any[]) {
  const results: { branchName: string; linearId: string; branchType: string; createdAt: string }[] = [];

  for (const event of events) {
    if (event.type !== "CreateEvent") continue;
    if (event.payload?.ref_type !== "branch") continue;

    const branchName = event.payload?.ref;
    const branch = parseQualifyingBranch(branchName);
    if (!branch) continue;

    results.push({
      branchName,
      linearId: branch.linearId,
      branchType: branch.type,
      createdAt: event.created_at,
    });
  }

  return results;
}

// Best-effort substitute for a GitHub webhook when the repo owner can't (or
// hasn't yet) granted admin access to register one: polls the repo's own
// events feed for CreateEvent(branch) entries and records them the same way
// the webhook would. Safe to call repeatedly — upsertBranchCreatedEvent is
// idempotent (ON CONFLICT DO NOTHING), so re-polling never overwrites an
// already-recorded creation timestamp, regardless of which source wrote it
// first (webhook or poll).
export async function pollBranchCreationEvents(repo: string, token: string, schema = "portal"): Promise<number> {
  let recorded = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const events = await fetchRepoEvents(repo, token, page, PER_PAGE);
    if (!events.length) break;

    const creates = extractBranchCreateEvents(events);
    for (const c of creates) {
      try {
        await upsertBranchCreatedEvent(schema, repo, c.branchName, c.linearId, c.branchType, c.createdAt);
        recorded++;
      } catch (error) {
        console.error(`❌ pollBranchCreationEvents: failed to record ${c.branchName}:`, error.message);
      }
    }

    if (events.length < PER_PAGE) break;
  }

  console.log(`📡 pollBranchCreationEvents: recorded ${recorded} branch-create event(s) for ${repo}`);
  return recorded;
}
