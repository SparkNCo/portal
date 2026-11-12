// @ts-nocheck
// Global query (SPA-582): POST /ask { slug, question } — a plain-text answer
// to a question about one client's project, grounded in its stored
// documents, test cases and issues, with the sources it came from.
//
// 1. The caller must be signed in and allowed to see that client (access.ts).
// 2. The question is embedded and matched against portal.embeddings, scoped
//    to the client in SQL (lib/vector.ts searchProject).
// 3. Nothing relevant enough: "not found", without calling the AI.
// 4. Otherwise the AI answers from those sources only (prompt.ts), through
//    the portal's AI client (AI_* secrets), and cites them.
import { serveWithCors } from "../utils/serve.ts";
import { supabase } from "../client.ts";
import { resolveCaller } from "../users/resolveCaller.ts";
import { AiBusyError, aiEnabled, requestJson } from "../lib/aiClient.ts";
import { searchProject, type ProjectMatch } from "../lib/vector.ts";
import { canAsk, findClient } from "./access.ts";
import {
  buildAskPrompt,
  citedSources,
  MAX_QUESTION_LENGTH,
  relevantSources,
  type AskReply,
  type Source,
} from "./prompt.ts";

const SCHEMA = "portal";

// What the page shows for each cited source, and how it opens it. `kind`
// (issues only) sends bugs to the Bugs page and the rest to Build.
type SourceOut = Source & { id: string; kind?: "bug" | "feature" | null };

// Turns the matched chunks into sources with their details (title, dates,
// status). A match whose object is gone by now is dropped.
async function withDetails(matches: ProjectMatch[]): Promise<SourceOut[]> {
  const ids = (type: string, key: keyof ProjectMatch) =>
    matches.filter((m) => m.source_type === type).map((m) => m[key]);

  const [documents, tests, issues] = await Promise.all([
    ids("document", "document_id").length
      ? supabase.schema(SCHEMA).from("documents").select("id, file_name, category, created_at").in("id", ids("document", "document_id"))
      : { data: [] },
    ids("test", "test_id").length
      ? supabase.schema(SCHEMA).from("tests").select("id, title, created_at").in("id", ids("test", "test_id"))
      : { data: [] },
    ids("issue", "issue_id").length
      ? supabase.schema(SCHEMA).from("issue_vectors").select("id, identifier, title, state, due_date, linear_created_at, kind").in("id", ids("issue", "issue_id"))
      : { data: [] },
  ]);
  for (const result of [documents, tests, issues]) {
    if (result.error) throw new Error(result.error.message);
  }
  const doc = new Map((documents.data ?? []).map((d) => [String(d.id), d]));
  const test = new Map((tests.data ?? []).map((t) => [t.id, t]));
  const issue = new Map((issues.data ?? []).map((i) => [i.id, i]));

  const out: SourceOut[] = [];
  for (const m of matches) {
    if (m.source_type === "document" && doc.has(String(m.document_id))) {
      const d = doc.get(String(m.document_id));
      out.push({ type: "document", id: String(d.id), ref: String(d.id), title: d.file_name, createdAt: d.created_at, content: m.content, similarity: m.similarity });
    } else if (m.source_type === "test" && test.has(m.test_id)) {
      const t = test.get(m.test_id);
      out.push({ type: "test", id: t.id, ref: t.id.slice(0, 8), title: t.title, createdAt: t.created_at, content: m.content, similarity: m.similarity });
    } else if (m.source_type === "issue" && issue.has(m.issue_id)) {
      const i = issue.get(m.issue_id);
      out.push({
        type: "issue",
        id: i.id,
        ref: i.identifier ?? i.id.slice(0, 8),
        title: i.title,
        createdAt: i.linear_created_at,
        dueDate: i.due_date,
        status: i.state,
        kind: i.kind ?? null,
        content: m.content,
        similarity: m.similarity,
      });
    }
  }
  return out;
}

// The page doesn't need the chunk text or the scores.
const forPage = (sources: SourceOut[]) =>
  sources.map(({ type, id, ref, title, status, kind }) => ({ type, id, ref, title, status: status ?? null, kind: kind ?? null }));

serveWithCors("ask API Error", async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const caller = await resolveCaller(req, SCHEMA);
  if (!caller) {
    return Response.json({ error: "Sign in to ask questions" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!slug) {
    return Response.json({ error: "slug is required" }, { status: 400 });
  }
  if (!question) {
    return Response.json({ error: "Ask a question" }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return Response.json({ error: `Keep the question under ${MAX_QUESTION_LENGTH} characters` }, { status: 400 });
  }

  const client = await findClient(slug);
  // Same answer for "no such client" and "not yours": nothing about other
  // clients leaks through this endpoint.
  if (!client || !(await canAsk(caller, client))) {
    return Response.json({ error: "You don't have access to this project" }, { status: 403 });
  }

  const matches = relevantSources(await searchProject(client.linearSlug, question));
  const sources = await withDetails(matches);
  if (sources.length === 0) {
    return Response.json({ question, found: false, answer: "", sources: [] });
  }

  if (!aiEnabled()) {
    return Response.json({ error: "AI isn't configured for the portal (no AI_API_KEY)." }, { status: 503 });
  }

  let reply: AskReply;
  try {
    reply = await requestJson<AskReply>(buildAskPrompt(question, sources), {
      name: "project_answer",
      schema: {
        type: "object",
        properties: {
          found: { type: "boolean" },
          answer: { type: "string" },
          sources: { type: "array", items: { type: "integer" } },
        },
        required: ["found", "answer", "sources"],
        additionalProperties: false,
      },
    });
  } catch (err) {
    if (err instanceof AiBusyError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }

  const cited = reply.found ? citedSources(reply, sources) : [];
  return Response.json({
    question,
    found: !!reply.found && !!reply.answer?.trim(),
    answer: (reply.answer ?? "").trim(),
    sources: forPage(cited),
  });
});
