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
  mysql: {
    name: "MySQL",
    example: "shop.orders",
    rules: [
      "In MySQL the schema is the database: qualify tables with the schema shown above.",
      `At most ${MAX_ROWS} rows: add a LIMIT when the question doesn't already ask for fewer.`,
      "MySQL refuses LIMIT inside IN / ANY / ALL / SOME subqueries: for a \"top N\" filter, JOIN a derived table or a CTE that has the LIMIT instead.",
      "Use MySQL functions (NOW(), CURDATE(), DATE_SUB, DATE_FORMAT, YEAR…). Text comparisons with LIKE are case-insensitive under the default collation.",
      "Quote identifiers with `backticks` when they clash with reserved words.",
    ],
  },
};

// When the same question goes to several connections, every query is asked
// for the same result columns (planned once, see planResult in prompt.ts),
// so their rows line up in one table.
function columnsRule(columns: string[] | undefined): string {
  if (!columns?.length) {
    return "- Give result columns clear names with AS (e.g. total_revenue), and order the rows in the way that best answers the question.";
  }
  return `- Return exactly these result columns, in this order, each named with AS exactly as written: ${columns.join(", ")}. Add no other columns. If one of them can't be computed from these tables, return NULL AS that name. Order the rows in the way that best answers the question.`;
}

export function buildPrompt(
  structure: Structure,
  question: string,
  today: string,
  engine = "postgres",
  columns?: string[],
): string {
  const dialect = DIALECTS[engine] ?? DIALECTS.postgres;
  return `You write ${dialect.name} queries for a business user who asks questions in plain language (in any language).

The database has exactly these tables and columns — use no others:

${describeStructure(structure)}

Rules:
- Write ONE read-only query: a single SELECT (CTEs with WITH are fine). Never INSERT, UPDATE, DELETE, DDL, or more than one statement.
- Schema-qualify every table (e.g. ${dialect.example}).
${columnsRule(columns)}
- Join tables only through the foreign keys shown above (→), with an explicit ON matching those columns; never join without ON, through a cross join, or on columns that merely share a name. Check each join: a wrong one makes every group show the same total.
- Don't join two one-to-many tables of the same parent before aggregating (it multiplies the rows and inflates SUM / COUNT): aggregate each one in its own subquery or CTE first, then join the results.
- With GROUP BY, every column in SELECT, ORDER BY or HAVING must be grouped or inside an aggregate. To order groups by something else, aggregate it (e.g. "latest customers" → ORDER BY MAX(o.ordered_at) DESC).
${dialect.rules.map((rule) => `- ${rule}`).join("\n")}
- Today is ${today}; resolve relative dates ("this year", "last month") from it.
- If the question can't be answered from these tables, set answerable to false, sql to an empty string, and say why in explanation.
- explanation: one or two short sentences saying what the query returns, written in the language the question is written in (an English question gets an English explanation, a Spanish one a Spanish explanation). Never switch to another language, such as Chinese, that the question doesn't use.

Question: ${question}

Write the explanation in the same language as the question above.`;
}

// ─── Shared result columns (one question, several connections) ───────────

const MAX_PLANNED_COLUMNS = 8;
const COLUMN_NAME = /^[a-z][a-z0-9_]{0,62}$/;

// Sees only the question — no structure, no data.
export function buildColumnsPrompt(question: string): string {
  return `A business user's question is answered by running SQL on several databases, and their results are shown together in one table. Decide the columns that table should have, so every database's query uses the same names, and how the combined rows should be ordered.

Rules:
- Only the columns needed to answer the question, in the order they should be shown.
- snake_case names in English, short and specific (e.g. product_name, total_quantity_sold, order_month).
- No rank, position or row-number columns unless the question asks for one: the order of the rows already shows the ranking.
- At most ${MAX_PLANNED_COLUMNS} columns.
- orderBy: the column the combined rows should be sorted by (one of your columns), or null when the order doesn't matter. descending: true for "top", "best", "most", "latest"…
- limit: how many rows the question asks for in total (e.g. "top 10" → 10), or null when it doesn't say.

Question: ${question}`;
}

// How the combined table is ordered and cut, across every connection: each
// database returns its own "top 10", so the merge re-sorts them and keeps 10.
export type ResultOrder = {
  orderBy: string | null;
  descending: boolean;
  limit: number | null;
};

export type ResultPlan = ResultOrder & { columns: string[] };

export function cleanPlan(plan: unknown): ResultPlan {
  const raw = (plan && typeof plan === "object" ? plan : {}) as Record<string, unknown>;
  const columns = cleanColumns(raw.columns);
  const orderBy = typeof raw.orderBy === "string" ? raw.orderBy.trim().toLowerCase() : "";
  const limit = typeof raw.limit === "number" && Number.isInteger(raw.limit) ? raw.limit : 0;
  return {
    columns,
    // Only one of the planned columns: anything else couldn't be found.
    orderBy: columns.includes(orderBy) ? orderBy : null,
    descending: raw.descending === true,
    limit: limit >= 1 && limit <= MAX_ROWS ? limit : null,
  };
}

// Only safe, distinct snake_case names: they go straight into the SQL prompt
// as aliases.
export function cleanColumns(columns: unknown): string[] {
  if (!Array.isArray(columns)) {
    return [];
  }
  const names = columns
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.trim().toLowerCase())
    .filter((c) => COLUMN_NAME.test(c));
  return [...new Set(names)].slice(0, MAX_PLANNED_COLUMNS);
}
