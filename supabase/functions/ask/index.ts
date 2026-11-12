// @ts-nocheck
// Global query (SPA-582): POST /ask { slug, question } — a plain-text answer
// to a question about one client's project, grounded in its stored
// documents, test cases and issues, with the sources it came from.
//
// 1. The caller must be signed in and allowed to see that client (access.ts).
// 2. The question is embedded and matched against portal.embeddings, scoped
//    to the client in SQL (lib/vector.ts searchProject). Ticket codes in the
//    question (SPA-582) are also looked up exactly and go first.
// 3. The client's tickets are fetched live from its ticket system (status,
//    cycle, priority, assignee, due date) for questions about the tickets as
//    a whole ("what's in the current cycle?"), which matching text can't
//    answer.
// 4. Nothing relevant and no tickets: "not found", without calling the AI.
// 5. Otherwise the AI answers from that only (prompt.ts), through the
//    portal's AI client (AI_* secrets), and cites what it used.
import { serveWithCors } from "../utils/serve.ts";
import { supabase } from "../client.ts";
import { resolveCaller } from "../users/resolveCaller.ts";
import { AiBusyError, aiEnabled, requestJson } from "../lib/aiClient.ts";
import { searchProject, type ProjectMatch } from "../lib/vector.ts";
import { canAsk, findClient } from "./access.ts";
import { ticketsForSlug } from "../lib/tickets/provider.ts";
import { deriveIssueKind } from "../lib/vector.ts";
import {
  buildAskPrompt,
  citedSources,
  citedTickets,
  issueCodesIn,
  ticketList,
  MAX_QUESTION_LENGTH,
  relevantSources,
  withExactMatches,
  type AskReply,
  type Source,
  type TicketRow,
} from "./prompt.ts";
import { escapeIlike } from "../utils/slug.ts";

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

// Tickets the question names by code (SPA-582), looked up exactly in this
// client's issue_vectors, as matches with the best chunk to show: the first
// description chunk, or the title (chunk 0) when there's no description.
async function issuesByCode(linearSlug: string, question: string): Promise<ProjectMatch[]> {
  const codes = issueCodesIn(question);
  if (codes.length === 0) return [];

  const { data: issues, error } = await supabase.schema(SCHEMA)
    .from("issue_vectors")
    .select("id, identifier")
    .ilike("project_slug", escapeIlike(linearSlug))
    .in("identifier", codes);
  if (error) throw new Error(error.message);
  if (!issues?.length) return [];

  const { data: chunks, error: chunksError } = await supabase.schema(SCHEMA)
    .from("embeddings")
    .select("issue_id, chunk_index, content")
    .in("issue_id", issues.map((i) => i.id))
    .lte("chunk_index", 1);
  if (chunksError) throw new Error(chunksError.message);
  const best = new Map<string, { chunk_index: number; content: string }>();
  for (const chunk of chunks ?? []) {
    const current = best.get(chunk.issue_id);
    if (!current || chunk.chunk_index > current.chunk_index) best.set(chunk.issue_id, chunk);
  }

  // In the order the question names them.
  const byCode = new Map(issues.map((i) => [String(i.identifier).toUpperCase(), i.id]));
  return codes
    .map((code) => byCode.get(code))
    .filter((id): id is string => !!id)
    .map((id) => ({
      source_type: "issue",
      document_id: null,
      test_id: null,
      issue_id: id,
      chunk_index: best.get(id)?.chunk_index ?? 0,
      content: best.get(id)?.content ?? "",
      // Named exactly: as relevant as it gets.
      similarity: 1,
    }));
}

// Statuses that close a ticket in the portal (STATUS_ORDER in
// components/client/issues.types.ts), plus Linear's own closed ones.
const CLOSED_STATUSES = new Set(["Done", "Approved", "Canceled", "Cancelled", "Duplicate"]);
// The portal's open statuses: asked for on their own when the full list hits
// Linear's 100-ticket page, so open work is never the part that's cut.
const OPEN_STATUSES = ["Backlog", "Planning", "Business Review", "Development", "QA", "UAT", "Todo", "In Progress", "In Review"];
const TICKET_PAGE = 100;

function toTicketRow(issue: any): TicketRow | null {
  if (!issue?.id || !issue?.identifier) return null;
  const status = issue.state?.name ?? null;
  const cycle = issue.cycle
    ? {
        number: typeof issue.cycle.number === "number" ? issue.cycle.number : null,
        name: issue.cycle.name ?? null,
        startsAt: issue.cycle.startsAt ?? null,
        endsAt: issue.cycle.endsAt ?? null,
        isActive: !!issue.cycle.isActive,
      }
    : null;
  return {
    id: issue.id,
    code: issue.identifier,
    title: issue.title ?? "",
    status,
    cycle,
    priority: issue.priorityLabel ?? null,
    assignee: issue.assignee?.displayName ?? issue.assignee?.email ?? null,
    dueDate: issue.dueDate ?? null,
    kind: deriveIssueKind(issue.labels?.nodes),
    closed: CLOSED_STATUSES.has(status ?? "") || !!issue.completedAt || !!issue.canceledAt,
    updatedAt: issue.updatedAt ?? null,
  };
}

// Every ticket of the client, live from its ticket system (Linear or Jira),
// already scoped to the client by the adapter. Best-effort: if the ticket
// system fails, the answer goes on without the list.
async function liveTickets(clientName: string): Promise<TicketRow[]> {
  try {
    const { tickets } = await ticketsForSlug(clientName);
    const all = await tickets.listIssues();
    // Linear returns one page of 100: fetch the open ones on their own so
    // the current work is always in.
    const open = all.length >= TICKET_PAGE ? await tickets.listIssues(OPEN_STATUSES) : [];
    const byId = new Map<string, TicketRow>();
    for (const issue of [...open, ...all]) {
      const row = toTicketRow(issue);
      if (row && !byId.has(row.id)) byId.set(row.id, row);
    }
    return [...byId.values()];
  } catch (err) {
    console.error("[ask] ticket list failed (answering without it):", err);
    return [];
  }
}

const matchKey = (m: ProjectMatch) => `${m.source_type}:${m.document_id ?? m.test_id ?? m.issue_id}`;

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

  const [exact, similar, tickets] = await Promise.all([
    issuesByCode(client.linearSlug, question),
    searchProject(client.linearSlug, question),
    liveTickets(client.clientName),
  ]);
  const matches = withExactMatches(exact, relevantSources(similar), matchKey);
  const sources = await withDetails(matches);
  if (sources.length === 0 && tickets.length === 0) {
    return Response.json({ question, found: false, answer: "", sources: [] });
  }

  if (!aiEnabled()) {
    return Response.json({ error: "AI isn't configured for the portal (no AI_API_KEY)." }, { status: 503 });
  }

  let reply: AskReply;
  try {
    reply = await requestJson<AskReply>(buildAskPrompt(question, sources, ticketList(tickets)), {
      name: "project_answer",
      schema: {
        type: "object",
        properties: {
          found: { type: "boolean" },
          answer: { type: "string" },
          sources: { type: "array", items: { type: "integer" } },
          tickets: { type: "array", items: { type: "string" } },
        },
        required: ["found", "answer", "sources", "tickets"],
        additionalProperties: false,
      },
    });
  } catch (err) {
    if (err instanceof AiBusyError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }

  const cited = reply.found ? forPage(citedSources(reply, sources)) : [];
  // Tickets from the live list the answer is about, after the numbered
  // sources and without repeating one already there.
  const listed = reply.found
    ? citedTickets(reply, tickets)
        .filter((row) => !cited.some((s) => s.type === "issue" && s.id === row.id))
        .map((row) => ({ type: "issue", id: row.id, ref: row.code, title: row.title, status: row.status, kind: row.kind }))
    : [];
  return Response.json({
    question,
    found: !!reply.found && !!reply.answer?.trim(),
    answer: (reply.answer ?? "").trim(),
    sources: [...cited, ...listed],
  });
});
