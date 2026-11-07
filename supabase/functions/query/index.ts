// @ts-nocheck
// Query (SPA-492): a plain-text question about a client's databases.
//   POST /query { dataSourceIds, question }
// The question is asked of every listed connection at once. For each, the AI
// writes SQL from that connection's stored structure (never its data), and
// it runs read-only against the client's database. Responds with one answer
// per connection, plus `combined`: all their rows in one table. With several
// connections the result columns are planned first, so they line up.
// Admins only, checked from the session token.
import { serveWithCors } from "../utils/serve.ts";
import { supabase } from "../client.ts";
import { resolveCaller } from "../users/resolveCaller.ts";
import { AiBusyError, aiEnabled } from "../lib/aiClient.ts";
import { runWithConcurrency } from "../utils/concurrency.ts";
import { SCHEMAS_BUCKET } from "../data-sources/columns.ts";
import { findDataSource, storedPassword } from "../data-sources/manageDataSources.ts";
import { configFor, engineFor } from "../data-sources/engines.ts";
import { generateQuery, planResult } from "./prompt.ts";
import type { ResultPlan } from "./describeStructure.ts";
import { checkSql } from "./checkSql.ts";
import { combineAnswers } from "./combineAnswers.ts";

const MAX_QUESTION_LENGTH = 2000;
// One AI call per connection — enough for a client's databases without
// flooding the AI provider from a single question.
const MAX_CONNECTIONS = 10;
const CONCURRENCY = 3;

// get schema from storage
async function loadStructure(schemaPath: string) {
  const { data, error } = await supabase.storage.from(SCHEMAS_BUCKET).download(schemaPath);
  if (error || !data) {
    throw new Error("Couldn't load the database's structure. Try Refresh structure.");
  }
  return JSON.parse(await data.text());
}

// The AI writes the SQL. Timed (also when it fails) so the logs show where a
// slow answer's time goes.
async function writeSql(structure: any, question: string, dataSource: any, columns: string[]) {
  const start = Date.now();
  try {
    const generated = await generateQuery(structure, question, dataSource.type, columns);
    console.log("[query] AI wrote the SQL", { id: dataSource.id, ms: Date.now() - start, tables: structure.tables?.length });
    return generated;
  } catch (err) {
    console.error("[query] AI call failed", { id: dataSource.id, ms: Date.now() - start, error: err?.message });
    throw err;
  }
}

// One connection's answer. Never throws: anything that goes wrong becomes
// that connection's `error`, so one bad database doesn't sink the others.
async function answerFrom(dataSourceId: string, question: string, columns: string[]) {
  let dataSource = null;
  try {
    dataSource = await findDataSource(dataSourceId);
  } catch (err) {
    console.error("[query] loading the connection failed", { id: dataSourceId, error: err?.message });
  }
  if (!dataSource) {
    return { dataSourceId, dataSourceName: "", explanation: "", sql: "", error: "Connection not found" };
  }

  const base = { dataSourceId, dataSourceName: dataSource.name, explanation: "", sql: "" };
  if (!dataSource.schema_path) {
    return { ...base, error: "This connection's structure hasn't been read yet. Use Refresh structure first." };
  }

  let generated;
  try {
    generated = await writeSql(await loadStructure(dataSource.schema_path), question, dataSource, columns);
  } catch (err) {
    if (err instanceof AiBusyError) {
      return { ...base, error: err.message, aiBusy: true };
    }
    return { ...base, error: err?.message ?? "Couldn't write the SQL." };
  }

  const answer = { ...base, explanation: generated.explanation, sql: generated.sql };
  // Not an error: this database just doesn't hold what was asked.
  if (!generated.answerable) {
    return { ...answer, unanswerable: true, error: generated.explanation };
  }

  const checked = checkSql(generated.sql);
  if ("error" in checked) {
    return { ...answer, error: checked.error };
  }

  const engine = engineFor(dataSource.type);
  try {
    const config = configFor(dataSource, await storedPassword(dataSource.id));
    try {
      const sqlStart = Date.now();
      const result = await engine.run(config, checked.sql);
      console.log("[query] SQL ran", { id: dataSource.id, ms: Date.now() - sqlStart });
      return { ...answer, sql: checked.sql, ...result };
    } catch (err) {
      console.error("[query] running the generated SQL failed", { id: dataSource.id, code: err?.code, error: err?.message });
      return { ...answer, sql: checked.sql, error: engine.describeQueryError(err, config) };
    }
  } catch (err) {
    return { ...answer, sql: checked.sql, error: err?.message ?? "Couldn't connect to the database." };
  }
}

// Several connections: the result columns are decided once, so every query
// names them the same way, along with how the combined rows are sorted and
// cut (planResult). Best-effort — if that call fails, each connection names
// its columns freely and the merge still works, just with more columns.
const NO_PLAN: ResultPlan = { columns: [], orderBy: null, descending: false, limit: null };

async function sharedPlan(question: string): Promise<ResultPlan> {
  const start = Date.now();
  try {
    const plan = await planResult(question);
    console.log("[query] planned the result", { ms: Date.now() - start, plan });
    return plan;
  } catch (err) {
    console.error("[query] planning the result failed (non-fatal)", { ms: Date.now() - start, error: err?.message });
    return NO_PLAN;
  }
}

function parseIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const ids = [...new Set(value.filter((v) => typeof v === "string" && v))];
  return ids.length > 0 ? ids : null;
}

serveWithCors("query API Error", async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const caller = await resolveCaller(req, "portal");
  if (!caller) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (caller.role !== "admin") {
    return Response.json({ error: "Only admins can use Query" }, { status: 403 });
  }

  if (!aiEnabled()) {
    return Response.json({ error: "AI isn't configured for the portal (no AI_API_KEY)." }, { status: 503 });
  }

  const body = await req.json();
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) {
    return Response.json({ error: "Ask a question" }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return Response.json({ error: `Keep the question under ${MAX_QUESTION_LENGTH} characters` }, { status: 400 });
  }

  const ids = parseIds(body?.dataSourceIds);
  if (!ids) {
    return Response.json({ error: "Pick at least one connection" }, { status: 400 });
  }
  if (ids.length > MAX_CONNECTIONS) {
    return Response.json({ error: `Ask at most ${MAX_CONNECTIONS} connections at once` }, { status: 400 });
  }

  const plan = ids.length > 1 ? await sharedPlan(question) : NO_PLAN;

  // Kept in the order asked, whatever order they finish in.
  const answers = new Array(ids.length);
  await runWithConcurrency(
    ids.map((id, index) => ({ id, index })),
    CONCURRENCY,
    async ({ id, index }) => {
      answers[index] = await answerFrom(id, question, plan.columns);
    },
  );

  // The AI provider was busy for every connection: one readable 503, as before.
  if (answers.every((a) => a.aiBusy)) {
    return Response.json({ error: answers[0].error }, { status: 503 });
  }

  return Response.json({ question, answers, combined: combineAnswers(answers, plan) });
});
