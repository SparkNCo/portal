import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { joinBranchEvents } from "./lifecycle.ts";

function makePR(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    number: 1,
    title: "feat/SPA-123-add-login",
    merged_at: "2026-07-02T10:00:00.000Z",
    merge_commit_sha: "merge-sha-1",
    html_url: "https://github.com/org/repo/pull/1",
    head: { ref: "feat/SPA-123-add-login" },
    ...overrides,
  };
}

function commitAt(date: string) {
  return { commit: { author: { date } } };
}

const noCommits = async () => [];
const alwaysSquashed = async () => true;
const alwaysOnMain = async () => true;

Deno.test("feat happy path: produces branch_created_at, dev_completed_at, deployed_at for a qualifying branch", async () => {
  const pr = makePR();
  const branchCreatedAtByName = new Map([["feat/SPA-123-add-login", "2026-07-01T08:00:00.000Z"]]);

  const events = await joinBranchEvents([pr], "feat", branchCreatedAtByName, noCommits, alwaysSquashed, alwaysOnMain);

  assertEquals(events.length, 1);
  assertEquals(events[0].linear_issue_id, "SPA-123");
  assertEquals(events[0].branch_type, "feat");
  assertEquals(events[0].branch_created_at, "2026-07-01T08:00:00.000Z");
  assertEquals(events[0].dev_start_source, "recorded");
  assertEquals(events[0].dev_completed_at, "2026-07-02T10:00:00.000Z");
  assertEquals(events[0].deployed_at, "2026-07-02T10:00:00.000Z");
});

Deno.test("fix branches follow the same lifecycle logic as feat branches", async () => {
  const pr = makePR({ head: { ref: "fix/SPA-456-crash-on-logout" }, title: "fix/SPA-456-crash-on-logout" });
  const branchCreatedAtByName = new Map([["fix/SPA-456-crash-on-logout", "2026-07-01T08:00:00.000Z"]]);

  const events = await joinBranchEvents([pr], "fix", branchCreatedAtByName, noCommits, alwaysSquashed, alwaysOnMain);

  assertEquals(events.length, 1);
  assertEquals(events[0].linear_issue_id, "SPA-456");
  assertEquals(events[0].branch_type, "fix");
});

Deno.test("falls back to the earliest commit date when no branch_created_at was recorded (no webhook)", async () => {
  const pr = makePR();
  const getCommits = async () => [commitAt("2026-07-01T09:00:00.000Z"), commitAt("2026-07-01T08:30:00.000Z")];

  const events = await joinBranchEvents([pr], "feat", new Map(), getCommits, alwaysSquashed, alwaysOnMain);

  assertEquals(events.length, 1);
  assertEquals(events[0].branch_created_at, "2026-07-01T08:30:00.000Z");
  assertEquals(events[0].dev_start_source, "first_commit_fallback");
});

Deno.test("excludes branches with no recorded branch_created_at and no commits to fall back on", async () => {
  const pr = makePR();
  const events = await joinBranchEvents([pr], "feat", new Map(), noCommits, alwaysSquashed, alwaysOnMain);
  assertEquals(events.length, 0);
});

Deno.test("excludes merges without a detectable squash-merge signal", async () => {
  const pr = makePR();
  const branchCreatedAtByName = new Map([["feat/SPA-123-add-login", "2026-07-01T08:00:00.000Z"]]);
  const neverSquashed = async () => false;

  const events = await joinBranchEvents([pr], "feat", branchCreatedAtByName, noCommits, neverSquashed, alwaysOnMain);
  assertEquals(events.length, 0);
});

Deno.test("excludes PRs with unsupported title prefixes", async () => {
  const pr = makePR({ title: "chore/SPA-123-cleanup", head: { ref: "chore/SPA-123-cleanup" } });
  const branchCreatedAtByName = new Map([["chore/SPA-123-cleanup", "2026-07-01T08:00:00.000Z"]]);

  const events = await joinBranchEvents([pr], "feat", branchCreatedAtByName, noCommits, alwaysSquashed, alwaysOnMain);
  assertEquals(events.length, 0);
});

Deno.test("deployed_at is null when the squash commit isn't (yet) reachable on main", async () => {
  const pr = makePR();
  const branchCreatedAtByName = new Map([["feat/SPA-123-add-login", "2026-07-01T08:00:00.000Z"]]);
  const notOnMain = async () => false;

  const events = await joinBranchEvents([pr], "feat", branchCreatedAtByName, noCommits, alwaysSquashed, notOnMain);
  assertEquals(events.length, 1);
  assertEquals(events[0].deployed_at, null);
  assertEquals(events[0].dev_completed_at, "2026-07-02T10:00:00.000Z");
});

Deno.test("recomputing on the same unchanged inputs yields identical output (deterministic)", async () => {
  const pr = makePR();
  const branchCreatedAtByName = new Map([["feat/SPA-123-add-login", "2026-07-01T08:00:00.000Z"]]);

  const first = await joinBranchEvents([pr], "feat", branchCreatedAtByName, noCommits, alwaysSquashed, alwaysOnMain);
  const second = await joinBranchEvents([pr], "feat", branchCreatedAtByName, noCommits, alwaysSquashed, alwaysOnMain);

  assertEquals(first, second);
});
