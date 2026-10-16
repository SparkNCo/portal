// @ts-nocheck
// The guard in front of the client's database (SPA-492): only one SELECT
// (or WITH … SELECT) is ever sent. No imports, so the unit tests can load it.

// The SQL without trailing semicolons, or why it can't be run.
export function checkSql(sql: string): { sql: string } | { error: string } {
  const trimmed = sql.trim().replace(/;+\s*$/, "").trim();
  if (!trimmed) return { error: "No query was generated." };
  if (trimmed.includes(";")) return { error: "The generated SQL has more than one statement, so it wasn't run." };
  if (!/^(select|with)\b/i.test(trimmed)) return { error: "The generated SQL isn't a SELECT query, so it wasn't run." };
  return { sql: trimmed };
}
