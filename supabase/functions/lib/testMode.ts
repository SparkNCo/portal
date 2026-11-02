// @ts-nocheck
// Test mode: run a supported flow end to end without its side effects. The
// flow still reads real data and does all its checks, but instead of sending
// emails or writing rows it records them on a TestRun, which the response
// hands back so a test can check what *would* have happened.
//
// Supported flows and what it guarantees: docs/TEST_MODE.md.
//
// A request opts in with the `x-test-mode: <TEST_MODE_TOKEN>` header. It's
// honoured only when the function has ALLOW_TEST_MODE=true *and* a
// TEST_MODE_TOKEN of at least 32 characters, and the header matches it.
// Anything else with the header present (test mode off, no token, wrong
// token) is refused outright — never run as a normal request. Without the
// header the flow runs exactly as it always has.
//
// Only the test suite sends the header (calling the functions directly, from
// Node); the app never does. It isn't in the CORS allow-list either, so a
// browser can't send it.

export const TEST_MODE_HEADER = "x-test-mode";

const MIN_TOKEN_LENGTH = 32;

export type CapturedEmail = { to: string | string[]; subject: string; html: string };

// A side effect the flow skipped: a row it would have written, an Auth
// account it would have created, a function it would have triggered…
export type SkippedWrite = { target: string; op: string; data?: unknown };

export type TestRun = { emails: CapturedEmail[]; writes: SkippedWrite[] };

export class TestModeRejected extends Error {}

// Compares in constant time, so the token can't be guessed by timing.
function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Null for a normal request; a fresh TestRun for an accepted test-mode one.
// Throws TestModeRejected when the header is there but can't be honoured.
export function resolveTestMode(req: Request): TestRun | null {
  const sent = req.headers.get(TEST_MODE_HEADER);
  if (sent === null) return null;

  const enabled = Deno.env.get("ALLOW_TEST_MODE") === "true";
  const token = Deno.env.get("TEST_MODE_TOKEN") ?? "";
  if (!enabled) throw new TestModeRejected("Test mode isn't enabled for this function");
  if (token.length < MIN_TOKEN_LENGTH) throw new TestModeRejected("Test mode is misconfigured");
  if (!sameToken(sent.trim(), token)) throw new TestModeRejected("Invalid test mode token");

  return { emails: [], writes: [] };
}

// What a test-mode request responds with: the flow's normal result plus what
// it held back.
export function testModeBody(run: TestRun, result: unknown) {
  return { testMode: true, result, emails: run.emails, writes: run.writes };
}
