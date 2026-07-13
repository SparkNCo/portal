import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { isSquashMerge, isReachableStatus, getEarliestCommitDate } from "./github.ts";

Deno.test("isSquashMerge: true for a single-parent merge commit with a brand-new SHA", () => {
  assertEquals(isSquashMerge("merge-sha", ["base-sha"], ["commit-1", "commit-2"]), true);
});

Deno.test("isSquashMerge: false for a regular two-parent merge commit", () => {
  assertEquals(isSquashMerge("merge-sha", ["base-sha", "head-sha"], ["commit-1", "commit-2"]), false);
});

Deno.test("isSquashMerge: false for a rebase merge (landed sha matches an original commit)", () => {
  assertEquals(isSquashMerge("commit-2", ["commit-1"], ["commit-1", "commit-2"]), false);
});

Deno.test("isReachableStatus: identical and behind mean reachable", () => {
  assertEquals(isReachableStatus("identical"), true);
  assertEquals(isReachableStatus("behind"), true);
});

Deno.test("isReachableStatus: ahead and diverged mean not (yet) reachable", () => {
  assertEquals(isReachableStatus("ahead"), false);
  assertEquals(isReachableStatus("diverged"), false);
});

function commitAt(date: string) {
  return { commit: { author: { date } } };
}

Deno.test("getEarliestCommitDate: returns the minimum author date across commits", () => {
  const commits = [
    commitAt("2026-07-02T10:00:00.000Z"),
    commitAt("2026-07-01T08:00:00.000Z"),
    commitAt("2026-07-03T12:00:00.000Z"),
  ];
  assertEquals(getEarliestCommitDate(commits), "2026-07-01T08:00:00.000Z");
});

Deno.test("getEarliestCommitDate: ignores commits missing an author date", () => {
  const commits = [{ commit: {} }, commitAt("2026-07-01T08:00:00.000Z")];
  assertEquals(getEarliestCommitDate(commits), "2026-07-01T08:00:00.000Z");
});

Deno.test("getEarliestCommitDate: returns null for no commits or no dates", () => {
  assertEquals(getEarliestCommitDate([]), null);
  assertEquals(getEarliestCommitDate([{ commit: {} }]), null);
});
