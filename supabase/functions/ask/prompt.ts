// The global query's prompt (SPA-582): a client's question answered only
// from that client's stored documents, test cases and issues. Two kinds of
// context:
//   - sources: the documents, tests and issues whose text matches the
//     question (portal.embeddings, each object's best chunk), numbered;
//   - the ticket list: every ticket fetched live from the ticket system, one
//     line each (status, cycle, priority, assignee, due date), for questions
//     about the tickets as a whole ("what's in the current cycle?").
// This file decides what's relevant and how it's written into the prompt.
// No imports, so the unit tests load it directly (tests/unit/ask.spec.ts).

// gte-small scores unrelated text around 0.8 (see issues' SIMILARITY_THRESHOLD),
// so anything below this isn't worth showing the AI. When nothing reaches it,
// the answer is "not found" without calling the AI at all.
export const MIN_SIMILARITY = 0.8;
export const MAX_SOURCES = 10;
// Per source, as the ticket asks: enough context without flooding the prompt.
export const MAX_CONTENT_CHARS = 2000;
export const MAX_QUESTION_LENGTH = 500;
// Lines in the ticket list: enough for a client's open work and recent
// history without flooding the prompt (~25 tokens each).
export const MAX_TICKET_ROWS = 150;
// Tickets the answer can list as sources from the ticket list.
export const MAX_CITED_TICKETS = 20;
const MAX_TICKET_TITLE_CHARS = 90;

export type SourceType = "document" | "test" | "issue";

export type Source = {
  type: SourceType;
  // What the source is called in the prompt and on screen: the issue's
  // identifier (SPA-456), the document's id, the test case's id.
  ref: string;
  title: string;
  createdAt: string | null;
  // Issues only.
  dueDate?: string | null;
  status?: string | null;
  content: string;
  similarity: number;
};

// Sources worth answering from: above MIN_SIMILARITY, best first, at most
// MAX_SOURCES. Empty means "not found".
export function relevantSources<T extends { similarity: number }>(matches: T[]): T[] {
  return matches
    .filter((m) => m.similarity >= MIN_SIMILARITY)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_SOURCES);
}

// Ticket codes in the question ("SPA-582", "spa-582"), uppercased, no
// repeats, at most MAX_SOURCES. Embeddings can't find a code (it isn't in the
// embedded text, and "SPA-582" and "SPA-583" embed almost the same), so these
// are looked up exactly by identifier instead.
const ISSUE_CODE = /\b[A-Za-z][A-Za-z0-9]{1,9}-\d{1,6}\b/g;

export function issueCodesIn(question: string): string[] {
  const codes = (question.match(ISSUE_CODE) ?? []).map((code) => code.toUpperCase());
  return [...new Set(codes)].slice(0, MAX_SOURCES);
}

// Tickets named by their code come first (they're exactly what was asked
// for), then the similarity matches, without the same object twice.
export function withExactMatches<T>(exact: T[], similar: T[], key: (match: T) => string): T[] {
  const seen = new Set(exact.map(key));
  return [...exact, ...similar.filter((m) => !seen.has(key(m)))].slice(0, MAX_SOURCES);
}

const LABEL: Record<SourceType, string> = { document: "Document", test: "Test case", issue: "Issue" };

function day(iso: string | null | undefined): string | null {
  return iso ? iso.slice(0, 10) : null;
}

// "Issue SPA-456: Login with SSO. Created 2020-02-02. Due 2021-03-03. Backlog"
export function sourceHeading(source: Source): string {
  const parts = [`${LABEL[source.type]} ${source.ref}: ${source.title}.`];
  const created = day(source.createdAt);
  if (created) parts.push(`Created ${created}.`);
  const due = day(source.dueDate);
  if (due) parts.push(`Due ${due}.`);
  if (source.status) parts.push(source.status);
  return parts.join(" ");
}

function clip(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > MAX_CONTENT_CHARS ? `${trimmed.slice(0, MAX_CONTENT_CHARS)}…` : trimmed;
}

// ── The ticket list ─────────────────────────────────────────────────────────

export type TicketRow = {
  id: string;
  // SPA-123
  code: string;
  title: string;
  status: string | null;
  cycle: { number: number | null; name: string | null; startsAt: string | null; endsAt: string | null; isActive: boolean } | null;
  priority: string | null;
  assignee: string | null;
  dueDate: string | null;
  kind: "bug" | "feature" | null;
  // Done, approved, canceled…: kept, but after the open work.
  closed: boolean;
  updatedAt: string | null;
};

const cycleName = (cycle: NonNullable<TicketRow["cycle"]>) =>
  cycle.number != null ? `Cycle ${cycle.number}` : (cycle.name ?? "a cycle");

const time = (iso: string | null) => (iso ? new Date(iso).getTime() || 0 : 0);

// Current-cycle tickets first, then the rest of the open work, then closed
// tickets; most recently updated first within each; at most MAX_TICKET_ROWS.
export function orderTickets(rows: TicketRow[]): TicketRow[] {
  const rank = (row: TicketRow) => (row.cycle?.isActive && !row.closed ? 0 : row.closed ? 2 : 1);
  return [...rows]
    .sort((a, b) => rank(a) - rank(b) || time(b.updatedAt) - time(a.updatedAt))
    .slice(0, MAX_TICKET_ROWS);
}

// "Current cycle: Cycle 16 (2026-11-03 to 2026-11-16)" — one line per active
// cycle (teams can each have their own).
function currentCycles(rows: TicketRow[]): string[] {
  const seen = new Map<string, string>();
  for (const row of rows) {
    const cycle = row.cycle;
    if (!cycle?.isActive) continue;
    const name = cycleName(cycle);
    const start = day(cycle.startsAt);
    const end = day(cycle.endsAt);
    seen.set(name, start && end ? `${name} (${start} to ${end})` : name);
  }
  return [...seen.values()];
}

// "SPA-582 · In the dashboard, add a global query · In Progress · Cycle 16 (current) · High · Facundo · due 2026-11-20 · feature"
export function ticketLine(row: TicketRow): string {
  const title = row.title.length > MAX_TICKET_TITLE_CHARS ? `${row.title.slice(0, MAX_TICKET_TITLE_CHARS)}…` : row.title;
  const parts = [row.code, title, row.status ?? "No status"];
  parts.push(row.cycle ? `${cycleName(row.cycle)}${row.cycle.isActive ? " (current)" : ""}` : "No cycle");
  if (row.priority && row.priority !== "No priority") parts.push(row.priority);
  parts.push(row.assignee ?? "Unassigned");
  const due = day(row.dueDate);
  if (due) parts.push(`due ${due}`);
  if (row.kind) parts.push(row.kind);
  return parts.join(" · ");
}

// The ticket list as written into the prompt; "" when there are no tickets.
export function ticketList(rows: TicketRow[]): string {
  if (rows.length === 0) return "";
  const ordered = orderTickets(rows);
  const cycles = currentCycles(rows);
  const header = [
    cycles.length ? `Current cycle: ${cycles.join("; ")}` : "No cycle is active right now.",
    ordered.length < rows.length ? `Showing ${ordered.length} of ${rows.length} tickets (current cycle and open work first).` : `${rows.length} tickets.`,
    "Format: code · title · status · cycle · priority · assignee · due date · type",
  ];
  return [...header, ...ordered.map(ticketLine)].join("\n");
}

// ── The prompt ──────────────────────────────────────────────────────────────

// Each source is numbered ([1], [2]…) so the answer can cite them by number;
// tickets from the ticket list are cited by code.
// The project's name in the prompt: one line, no quotes, bounded.
const projectLabel = (name?: string | null) => (name ?? "").replace(/["\r\n]+/g, " ").trim().slice(0, 100);

// `projectName`: the project the information below belongs to, so a question
// about another one ("how many tickets does Acme have?") is turned away
// instead of answered with this project's data under the other name. The
// data itself is already this project's only (scoped in SQL / by the
// ticket system, and the caller's access checked), so this is about not
// misleading, not about access.
export function buildAskPrompt(question: string, sources: Source[], tickets = "", projectName?: string | null): string {
  const project = projectLabel(projectName);
  const blocks = sources
    .map((source, i) => `[${i + 1}] ${sourceHeading(source)}\n${clip(source.content)}`)
    .join("\n\n");

  const sections = [
    tickets && `Ticket list (live from the ticket system, as of ${new Date().toISOString().slice(0, 10)}):\n\n${tickets}`,
    blocks && `Project information that matches the question (documents, test cases and issues):\n\n${blocks}`,
  ].filter(Boolean);

  const projectIntro = project ? `one software project, "${project}",` : "one software project";
  const otherProjectRule = project
    ? `
- Only "${project}": if the question asks about another project, client or company (e.g. by name), don't answer it from this information. Set found to false and say, in answer, that here you can only answer questions about "${project}", and that they can ask from that project's own page if they have access to it.`
    : "";

  return `You answer questions about ${projectIntro} for the people working on it, using ONLY the project information below.

${sections.join("\n\n---\n\n")}

Rules:
- Answer only from the information above. Don't use outside knowledge and don't guess. If it doesn't contain the answer, set found to false and say briefly, in answer, that the project's documents, tests and issues don't cover it.
- For questions about tickets as a whole (statuses, the current cycle, priorities, who's working on what, due dates, how many), use the ticket list. When it says it shows only some of the tickets, say your answer covers those.${otherProjectRule}
- For questions about what something is or how it works, use the numbered project information.
- Plain text, short and direct: a few sentences, or a short list when the question asks for several things.
- In sources, list the numbers ([1], [2]…) of every numbered item your answer relies on, and only those.
- In tickets, list the codes (e.g. "SPA-456") of the tickets from the ticket list your answer is about, and only those.
- When you mention an issue, document or test case in the answer, name it the way it appears above (e.g. "Issue SPA-456").
- Language: first set language to the language the question is written in, judging by the question alone (e.g. "English" for "How does login work?", "Spanish" for "¿Cómo funciona el login?"). Then write answer in that language, also when found is false. The project information above may be in another language, and these instructions are in English: neither changes the answer's language. Quote names, messages and codes as they appear, but write everything else in the question's language.

Question: ${question}

Answer in the same language as the question above (set language first).`;
}

// When nothing in the project matches at all (the AI isn't needed for an
// answer): only the "not found" sentence, in the question's language.
export function buildNotFoundPrompt(question: string): string {
  return `Someone asked a question about a software project, and nothing in the project's documents, test cases and issues covers it.

Write one short, friendly sentence telling them so and suggesting they try asking another way. Write it in the language the question is written in (Spanish for a question in Spanish, and so on). Don't answer the question itself.

Question: ${question}`;
}

// The AI's reply, as the JSON schema asks for it. `language` comes first on
// purpose: deciding the question's language before writing keeps the answer
// from drifting into the sources' language.
export type AskReply = { language?: string; found: boolean; answer: string; sources: number[]; tickets?: string[] };

// The tickets the answer is about, from the ticket list, by code; unknown or
// repeated codes are dropped; at most MAX_CITED_TICKETS.
export function citedTickets(reply: AskReply, rows: TicketRow[]): TicketRow[] {
  const byCode = new Map(rows.map((row) => [row.code.toUpperCase(), row]));
  const seen = new Set<string>();
  const cited: TicketRow[] = [];
  for (const code of reply.tickets ?? []) {
    const row = byCode.get(String(code).trim().toUpperCase());
    if (row && !seen.has(row.id)) {
      seen.add(row.id);
      cited.push(row);
    }
  }
  return cited.slice(0, MAX_CITED_TICKETS);
}

// The cited sources, by the AI's 1-based numbers; anything out of range or
// repeated is dropped.
export function citedSources<T>(reply: AskReply, sources: T[]): T[] {
  const seen = new Set<number>();
  const cited: T[] = [];
  for (const n of reply.sources ?? []) {
    if (Number.isInteger(n) && n >= 1 && n <= sources.length && !seen.has(n)) {
      seen.add(n);
      cited.push(sources[n - 1]!);
    }
  }
  return cited;
}
