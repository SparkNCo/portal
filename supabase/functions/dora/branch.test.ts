import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { computeDurationHours, parseQualifyingBranch } from "./branch.ts";

Deno.test("parses a qualifying feat branch with a Linear identifier", () => {
  assertEquals(parseQualifyingBranch("feat/SPA-123-add-login"), { type: "feat", linearId: "SPA-123" });
});

Deno.test("parses a qualifying fix branch with a Linear identifier", () => {
  assertEquals(parseQualifyingBranch("fix/SPA-456-crash-on-logout"), { type: "fix", linearId: "SPA-456" });
});

Deno.test("is case-insensitive on the prefix and normalizes the Linear id casing", () => {
  assertEquals(parseQualifyingBranch("Feat/spa-789-onboarding"), { type: "feat", linearId: "SPA-789" });
});

Deno.test("ignores branches with unsupported prefixes", () => {
  assertEquals(parseQualifyingBranch("release/SPA-123"), null);
  assertEquals(parseQualifyingBranch("chore/SPA-123"), null);
  assertEquals(parseQualifyingBranch("123-numeric-only"), null);
});

Deno.test("ignores feat/fix branches without a parseable Linear identifier", () => {
  assertEquals(parseQualifyingBranch("feat/add-login"), null);
  assertEquals(parseQualifyingBranch("fix/typo"), null);
});

Deno.test("returns null for empty or missing branch names", () => {
  assertEquals(parseQualifyingBranch(""), null);
  assertEquals(parseQualifyingBranch(null), null);
  assertEquals(parseQualifyingBranch(undefined), null);
});

Deno.test("computeDurationHours is deterministic across repeated calls on the same history", () => {
  const start = "2026-07-01T00:00:00.000Z";
  const end = "2026-07-01T05:30:00.000Z";

  const first = computeDurationHours(start, end);
  const second = computeDurationHours(start, end);

  assertEquals(first, 5.5);
  assertEquals(first, second);
});
