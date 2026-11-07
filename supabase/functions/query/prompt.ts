// @ts-nocheck
// Turns a plain-text question into SQL (SPA-492). The AI only ever sees the
// database's structure (tables, columns, keys, enum values) — never its data.
import { requestJson } from "../lib/aiClient.ts";
import { buildColumnsPrompt, buildPrompt, cleanPlan, type ResultPlan, type Structure } from "./describeStructure.ts";

export type GeneratedQuery = {
  answerable: boolean;
  sql: string;
  explanation: string;
};

export function generateQuery(
  structure: Structure,
  question: string,
  engine = "postgres",
  // Result column names every connection should use (see planResult).
  columns?: string[],
): Promise<GeneratedQuery> {
  const today = new Date().toISOString().slice(0, 10);
  return requestJson<GeneratedQuery>(buildPrompt(structure, question, today, engine, columns), {
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

// When one question goes to several connections, decides the answer's
// columns once — from the question alone (no structure, no data) — so each
// connection's query names them the same way and the rows line up in one
// table. Also how that table is sorted and how many rows it keeps ("top 10"
// across every connection, not 10 from each). Empty columns when it can't
// (the queries then name columns freely).
export async function planResult(question: string): Promise<ResultPlan> {
  const planned = await requestJson<unknown>(buildColumnsPrompt(question), {
    name: "result_plan",
    schema: {
      type: "object",
      properties: {
        columns: { type: "array", items: { type: "string" } },
        orderBy: { type: ["string", "null"] },
        descending: { type: "boolean" },
        limit: { type: ["integer", "null"] },
      },
      required: ["columns", "orderBy", "descending", "limit"],
      additionalProperties: false,
    },
  });
  return cleanPlan(planned);
}
