import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { extractBranchCreateEvents } from "./events.ts";

function createEvent(ref: string, refType = "branch", createdAt = "2026-07-01T08:00:00Z") {
  return { type: "CreateEvent", payload: { ref, ref_type: refType }, created_at: createdAt };
}

Deno.test("extracts a qualifying feat branch creation event", () => {
  const events = [createEvent("feat/SPA-123-add-login")];
  assertEquals(extractBranchCreateEvents(events), [
    { branchName: "feat/SPA-123-add-login", linearId: "SPA-123", branchType: "feat", createdAt: "2026-07-01T08:00:00Z" },
  ]);
});

Deno.test("extracts a qualifying fix branch creation event", () => {
  const events = [createEvent("fix/SPA-456-crash")];
  assertEquals(extractBranchCreateEvents(events), [
    { branchName: "fix/SPA-456-crash", linearId: "SPA-456", branchType: "fix", createdAt: "2026-07-01T08:00:00Z" },
  ]);
});

Deno.test("ignores non-CreateEvent event types", () => {
  const events = [{ type: "PushEvent", payload: { ref: "feat/SPA-123" }, created_at: "2026-07-01T08:00:00Z" }];
  assertEquals(extractBranchCreateEvents(events), []);
});

Deno.test("ignores CreateEvent for tags (ref_type !== branch)", () => {
  const events = [createEvent("v1.2.3", "tag")];
  assertEquals(extractBranchCreateEvents(events), []);
});

Deno.test("ignores non-qualifying branch names", () => {
  const events = [createEvent("chore/cleanup"), createEvent("release/1.0")];
  assertEquals(extractBranchCreateEvents(events), []);
});

Deno.test("processes a mixed page of events, keeping only qualifying branch creations", () => {
  const events = [
    createEvent("feat/SPA-1-a"),
    { type: "PullRequestEvent", payload: {}, created_at: "2026-07-01T08:00:00Z" },
    createEvent("chore/misc"),
    createEvent("fix/SPA-2-b"),
  ];
  const result = extractBranchCreateEvents(events);
  assertEquals(result.length, 2);
  assertEquals(result.map((r) => r.linearId), ["SPA-1", "SPA-2"]);
});
