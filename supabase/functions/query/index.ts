// @ts-nocheck
// Query (SPA-492): a plain-text question about a client's database.
//   POST /query { dataSourceId, question }
// The AI writes SQL from the connection's stored structure (never its
// data), and it runs read-only against the client's database. Responds with
// the SQL and either the rows or why there are none. Admins only, checked
// from the session token.
import { serveWithCors } from "../utils/serve.ts";
import { supabase } from "../client.ts";
import { resolveCaller } from "../users/resolveCaller.ts";
import { aiEnabled } from "../lib/aiClient.ts";
import { SCHEMAS_BUCKET } from "../data-sources/columns.ts";
import { findDataSource, storedPassword } from "../data-sources/manageDataSources.ts";
import { generateQuery } from "./prompt.ts";
import { checkSql, describeQueryError, runQuery } from "./runQuery.ts";

const MAX_QUESTION_LENGTH = 2000;

async function loadStructure(schemaPath: string) {
  const { data, error } = await supabase.storage.from(SCHEMAS_BUCKET).download(schemaPath);
  if (error || !data) throw new Error("Couldn't load the database's structure. Try Refresh structure.");
  return JSON.parse(await data.text());
}

serveWithCors("query API Error", async (req) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

  const caller = await resolveCaller(req, "portal");
  if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (caller.role !== "admin") return Response.json({ error: "Only admins can use Query" }, { status: 403 });

  if (!aiEnabled()) return Response.json({ error: "AI isn't configured for the portal (no AI_API_KEY)." }, { status: 503 });

  const body = await req.json();
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) return Response.json({ error: "Ask a question" }, { status: 400 });
  if (question.length > MAX_QUESTION_LENGTH) {
    return Response.json({ error: `Keep the question under ${MAX_QUESTION_LENGTH} characters` }, { status: 400 });
  }

  const dataSource = typeof body?.dataSourceId === "string" ? await findDataSource(body.dataSourceId) : null;
  if (!dataSource) return Response.json({ error: "Connection not found" }, { status: 404 });
  if (!dataSource.schema_path) {
    return Response.json({ error: "This connection's structure hasn't been read yet. Use Refresh structure first." }, { status: 400 });
  }

  const structure = await loadStructure(dataSource.schema_path);
  const generated = await generateQuery(structure, question);
  const answer = { question, explanation: generated.explanation, sql: generated.sql };

  if (!generated.answerable) return Response.json({ ...answer, error: generated.explanation });

  const checked = checkSql(generated.sql);
  if ("error" in checked) return Response.json({ ...answer, error: checked.error });

  const config = {
    host: dataSource.host,
    port: dataSource.port,
    database: dataSource.database_name,
    username: dataSource.username,
    password: await storedPassword(dataSource.id),
    ssl: dataSource.ssl,
  };

  try {
    const result = await runQuery(config, checked.sql);
    return Response.json({ ...answer, sql: checked.sql, ...result });
  } catch (err) {
    console.error("[query] running the generated SQL failed", { id: dataSource.id, code: err?.code, error: err?.message });
    return Response.json({ ...answer, sql: checked.sql, error: describeQueryError(err, config) });
  }
});
