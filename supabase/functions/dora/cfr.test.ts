import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { isCFRHotfix } from "./cfr.ts";

function pr(overrides: Partial<Record<string, unknown>> = {}) {
  return { title: "feat: add login", head: { ref: "feat/SPA-123-add-login" }, labels: [], ...overrides };
}

Deno.test("a fix/ branch counts as hotfix even when the PR title doesn't say fix", () => {
  const p = pr({ title: "Add login page", head: { ref: "fix/SPA-123-login-crash" } });
  assertEquals(isCFRHotfix(p, []), true);
});

Deno.test("a feat/ branch with a neutral title is not a hotfix", () => {
  const p = pr();
  assertEquals(isCFRHotfix(p, []), false);
});

Deno.test("title-based signals still work independently of branch name", () => {
  const p = pr({ title: "fix: SPA-123 crash on logout", head: { ref: "some-other-branch-name" } });
  assertEquals(isCFRHotfix(p, []), true);
});

Deno.test("commit-based hotfix signals still work regardless of branch or title", () => {
  const p = pr({ head: { ref: "feat/SPA-123-widget" } });
  const commits = [{ commit: { message: "revert: broke the build" } }];
  assertEquals(isCFRHotfix(p, commits), true);
});

Deno.test("a branch without feat/ or fix/ prefix relies solely on title/commit signals", () => {
  const p = pr({ title: "chore: bump deps", head: { ref: "chore/deps" } });
  assertEquals(isCFRHotfix(p, []), false);
});
