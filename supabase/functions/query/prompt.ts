// @ts-nocheck
// Turns a plain-text question into SQL (SPA-492). The AI only ever sees the
// database's structure (tables, columns, keys, enum values) — never its data.
import { requestJson } from "../lib/aiClient.ts";
import { buildPrompt, type Structure } from "./describeStructure.ts";

export type GeneratedQuery = {
  answerable: boolean;
  sql: string;
  explanation: string;
};

export function generateQuery(structure: Structure, question: string, engine = "postgres"): Promise<GeneratedQuery> {
  const today = new Date().toISOString().slice(0, 10);
  return requestJson<GeneratedQuery>(buildPrompt(structure, question, today, engine), {
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
