// @ts-nocheck
// Turns a plain-text question into SQL (SPA-492). The AI only ever sees the
// database's structure (tables, columns, keys, enum values) — never its data.
import { requestJson } from "../lib/aiClient.ts";

export const MAX_ROWS = 500;

type Structure = {
  tables: {
    schema: string;
    name: string;
    kind: string;
    comment: string | null;
    columns: { name: string; type: string; nullable: boolean; comment: string | null }[];
    primaryKey: string[];
    foreignKeys: { columns: string[]; references: { schema: string; table: string; columns: string[] } }[];
  }[];
  enums: { schema: string; name: string; values: string[] }[];
};

export type GeneratedQuery = {
  answerable: boolean;
  sql: string;
  explanation: string;
};

// One line per column, compact enough to fit large databases in the prompt:
//   public.orders (table) — One purchase by a customer
//     - id integer PK
//     - customer_id integer → public.customers.id
export function describeStructure(structure: Structure): string {
  const lines: string[] = [];
  for (const table of structure.tables) {
    lines.push(`${table.schema}.${table.name} (${table.kind})${table.comment ? ` — ${table.comment}` : ""}`);
    for (const column of table.columns) {
      const fk = table.foreignKeys.find((f) => f.columns.includes(column.name));
      const parts = [`  - ${column.name} ${column.type}`];
      if (table.primaryKey.includes(column.name)) parts.push("PK");
      if (!column.nullable) parts.push("not null");
      if (fk) {
        const target = fk.references.columns[fk.columns.indexOf(column.name)];
        parts.push(`→ ${fk.references.schema}.${fk.references.table}.${target}`);
      }
      if (column.comment) parts.push(`— ${column.comment}`);
      lines.push(parts.join(" "));
    }
  }
  if (structure.enums.length) {
    lines.push("", "Enum types:");
    for (const e of structure.enums) lines.push(`  - ${e.schema}.${e.name}: ${e.values.map((v) => `'${v}'`).join(", ")}`);
  }
  return lines.join("\n");
}

export function buildPrompt(structure: Structure, question: string, today: string): string {
  return `You write PostgreSQL queries for a business user who asks questions in plain language (in any language).

The database has exactly these tables and columns — use no others:

${describeStructure(structure)}

Rules:
- Write ONE read-only query: a single SELECT (CTEs with WITH are fine). Never INSERT, UPDATE, DELETE, DDL, or more than one statement.
- Schema-qualify every table (e.g. public.orders).
- Give result columns clear names with AS (e.g. total_revenue), and order the rows in the way that best answers the question.
- At most ${MAX_ROWS} rows: add a LIMIT when the question doesn't already ask for fewer.
- Compare text case-insensitively (ILIKE) unless the question needs exact matches.
- Today is ${today}; resolve relative dates ("this year", "last month") from it.
- If the question can't be answered from these tables, set answerable to false, sql to an empty string, and say why in explanation.
- explanation: one or two short sentences, in the same language as the question, saying what the query returns.

Question: ${question}`;
}

export function generateQuery(structure: Structure, question: string): Promise<GeneratedQuery> {
  const today = new Date().toISOString().slice(0, 10);
  return requestJson<GeneratedQuery>(buildPrompt(structure, question, today), {
    name: "sql_query",
    schema: {
      type: "object",
      properties: {
        answerable: { type: "boolean" },
        sql: { type: "string" },
        explanation: { type: "string" },
      },
      required: ["answerable", "sql", "explanation"],
      additionalProperties: false,
    },
  });
}
