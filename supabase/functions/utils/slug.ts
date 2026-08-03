// Escapes Postgres ILIKE wildcard metacharacters (`%`, `_`) and the escape
// character itself (`\`) in request-supplied values before they're used in
// an `.ilike()`/`ilike.` filter. Without this, a slug of e.g. "%" or "a%"
// turns a case-insensitive *exact* match into a pattern match against every
// (or arbitrary) row — this keeps `ilike` doing case-insensitive equality
// only, never pattern matching.
export function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
