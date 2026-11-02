// @ts-nocheck
// The prompt the AI writes SQL from (SPA-492): the database's structure as
// compact text, plus the rules. No imports, so the unit tests can load it.

export const MAX_ROWS = 500;

export type Structure = {
  tables: {
    schema: string;
    name: string;
    kind: string;
    comment: string | null;
    // `values`: the only values a column allows (a SQL Server CHECK, see
    // data-sources/sqlserverStructure.ts). Postgres has enum types instead.
    columns: { name: string; type: string; nullable: boolean; comment: string | null; values?: string[] }[];
    primaryKey: string[];
    foreignKeys: { columns: string[]; references: { schema: string; table: string; columns: string[] } }[];
  }[];
  enums: { schema: string; name: string; values: string[] }[];
};

const quoted = (values: string[]) => values.map((v) => "'" + v + "'").join(", ");

type Table = Structure["tables"][number];

// "  - customer_id integer not null → public.customers.id"
function describeColumn(table: Table, column: Table["columns"][number]): string {
  const parts = [`  - ${column.name} ${column.type}`];
  if (table.primaryKey.includes(column.name)) parts.push("PK");
  if (!column.nullable) parts.push("not null");
  if (column.values?.length) parts.push("(one of " + quoted(column.values) + ")");
  const fk = table.foreignKeys.find((f) => f.columns.includes(column.name));
  if (fk) {
    const target = fk.references.columns[fk.columns.indexOf(column.name)];
    parts.push(`→ ${fk.references.schema}.${fk.references.table}.${target}`);
  }
  if (column.comment) parts.push(`— ${column.comment}`);
  return parts.join(" ");
}

// One line per column, compact enough to fit large databases in the prompt:
//   public.orders (table) — One purchase by a customer
//     - id integer PK
//     - customer_id integer → public.customers.id
export function describeStructure(structure: Structure): string {
  const lines: string[] = [];
  for (const table of structure.tables) {
    const comment = table.comment ? ` — ${table.comment}` : "";
    lines.push(`${table.schema}.${table.name} (${table.kind})${comment}`);
    for (const column of table.columns) lines.push(describeColumn(table, column));
  }
  if (structure.enums.length) {
    lines.push("", "Enum types:");
    for (const e of structure.enums) lines.push(`  - ${e.schema}.${e.name}: ${quoted(e.values)}`);
  }
  return lines.join("\n");
}

// What changes between engines: the SQL dialect, how to cap rows and how to
// compare text. Everything else in the prompt is the same.
const DIALECTS: Record<string, { name: string; example: string; rules: string[] }> = {
  postgres: {
    name: "PostgreSQL",
    example: "public.orders",
    rules: [
      `At most ${MAX_ROWS} rows: add a LIMIT when the question doesn't already ask for fewer.`,
      "Compare text case-insensitively (ILIKE) unless the question needs exact matches.",
    ],
  },
  sqlserver: {
    name: "Microsoft SQL Server (T-SQL)",
    example: "dbo.orders",
    rules: [
      `At most ${MAX_ROWS} rows: use SELECT TOP (n), never LIMIT, when the question doesn't already ask for fewer. ORDER BY goes at the end of the outer query; inside a CTE or subquery only with TOP.`,
      "Use T-SQL functions (GETDATE(), DATEADD, DATEDIFF, YEAR, FORMAT…). Text comparisons with LIKE are case-insensitive under the default collation.",
      "Quote identifiers with [brackets] when they clash with reserved words.",
    ],
  },
};

export function buildPrompt(structure: Structure, question: string, today: string, engine = "postgres"): string {
  const dialect = DIALECTS[engine] ?? DIALECTS.postgres;
  return `You write ${dialect.name} queries for a business user who asks questions in plain language (in any language).

The database has exactly these tables and columns — use no others:

${describeStructure(structure)}

Rules:
- Write ONE read-only query: a single SELECT (CTEs with WITH are fine). Never INSERT, UPDATE, DELETE, DDL, or more than one statement.
- Schema-qualify every table (e.g. ${dialect.example}).
- Give result columns clear names with AS (e.g. total_revenue), and order the rows in the way that best answers the question.
${dialect.rules.map((rule) => `- ${rule}`).join("\n")}
- Today is ${today}; resolve relative dates ("this year", "last month") from it.
- If the question can't be answered from these tables, set answerable to false, sql to an empty string, and say why in explanation.
- explanation: one or two short sentences, in the same language as the question, saying what the query returns.

Question: ${question}`;
}
