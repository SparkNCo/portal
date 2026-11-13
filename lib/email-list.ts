// Emails typed or pasted as a list ("a@x.com, b@y.com; c@z.com"), for the
// document Share modal's pills. No imports, so the unit tests load it
// directly (tests/unit/email-list.spec.ts).

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export function isEmail(text: string): boolean {
  return EMAIL.test(text.trim());
}

// Every entry in the text, split on commas, semicolons and whitespace,
// trimmed and lowercased, without repeats. "Name <a@x.com>" gives a@x.com.
// Invalid entries are kept (shown as invalid pills) rather than dropped.
export function emailsIn(text: string): string[] {
  const entries = text
    .split(/[,;\s]+/)
    .map((e) => e.trim().replace(/^<|>$/g, "").toLowerCase())
    .filter(Boolean);
  return [...new Set(entries)];
}
