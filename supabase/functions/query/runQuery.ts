// @ts-nocheck
// Runs the generated SQL against the client's database, with the minimum
// safety agreed for now (SPA-492): a READ ONLY transaction (the database
// itself refuses any write), a 15 s statement timeout and at most MAX_ROWS
// rows. The AI is asked for a single SELECT too, and `checkSql` rejects
// anything else before it's sent.
import { type ConnectionConfig, describeConnectionError, withConnection } from "../data-sources/postgresClient.ts";
import { MAX_ROWS } from "./prompt.ts";

const STATEMENT_TIMEOUT_SECONDS = 15;

export type QueryResult = {
  columns: string[];
  rows: unknown[][];
  // More rows matched than MAX_ROWS; only the first MAX_ROWS are returned.
  truncated: boolean;
};

// The SQL without trailing semicolons, or why it can't be run.
export function checkSql(sql: string): { sql: string } | { error: string } {
  const trimmed = sql.trim().replace(/;+\s*$/, "").trim();
  if (!trimmed) return { error: "No query was generated." };
  if (trimmed.includes(";")) return { error: "The generated SQL has more than one statement, so it wasn't run." };
  if (!/^(select|with)\b/i.test(trimmed)) return { error: "The generated SQL isn't a SELECT query, so it wasn't run." };
  return { sql: trimmed };
}

// JSON-safe cell values: dates as ISO strings, binary data summarized.
function cell(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return `(${value.byteLength} bytes)`;
  return value;
}

export async function runQuery(config: ConnectionConfig, sql: string): Promise<QueryResult> {
  return await withConnection(config, (db) =>
    db.begin("read only", async (tx) => {
      await tx.unsafe(`set local statement_timeout = '${STATEMENT_TIMEOUT_SECONDS}s'`);
      // Wrapped so the row cap holds whatever LIMIT the query has. One extra
      // row tells whether there were more.
      const result = await tx.unsafe(`select * from (${sql}\n) as query_result limit ${MAX_ROWS + 1}`).values();
      const columns = (result.columns ?? []).map((c: any) => c.name);
      const rows = result.slice(0, MAX_ROWS).map((row: unknown[]) => row.map(cell));
      return { columns, rows, truncated: result.length > MAX_ROWS };
    })
  );
}

// What went wrong running it, for the person who asked.
export function describeQueryError(err: any, config: ConnectionConfig): string {
  const code = String(err?.code ?? "");
  if (code === "57014") return `The query took longer than ${STATEMENT_TIMEOUT_SECONDS} seconds and was stopped. Try a narrower question.`;
  if (code === "25006") return "The query tried to change data, and Query only reads. It wasn't run.";
  if (code === "42501") return "The database user isn't allowed to read one of the tables this needs.";
  return describeConnectionError(err, config, "The query failed: ");
}
