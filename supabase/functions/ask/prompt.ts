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


export function orderTickets(rows: TicketRow[]): TicketRow[] {
  const rank = (row: TicketRow) => (row.cycle?.isActive && !row.closed ? 0 : row.closed ? 2 : 1);
  return [...rows]
    .sort((a, b) => rank(a) - rank(b) || time(b.updatedAt) - time(a.updatedAt))
    .slice(0, MAX_TICKET_ROWS);
}


export function cycleCalendar(rows: TicketRow[], now = Date.now()): string[] {
  const byName = new Map<string, NonNullable<TicketRow["cycle"]>>();
  for (const row of rows) {
    if (row.cycle && !byName.has(cycleName(row.cycle))) byName.set(cycleName(row.cycle), row.cycle);
  }
  return [...byName.entries()]
    .sort(([, a], [, b]) => time(a.startsAt) - time(b.startsAt))
    .map(([name, cycle]) => {
      const start = day(cycle.startsAt);
      const end = day(cycle.endsAt);
      let when = "upcoming";
      if (cycle.isActive) when = "current";
      else if (cycle.endsAt && time(cycle.endsAt) < now) when = "past";
      const dates = start && end ? `${start} to ${end}, ` : "";
      return `${name} (${dates}${when})`;
    });
}


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

export function ticketList(rows: TicketRow[], now = Date.now()): string {
  if (rows.length === 0) return "";
  const ordered = orderTickets(rows);
  const cycles = currentCycles(rows);
  const calendar = cycleCalendar(ordered, now);
  const header = [
    cycles.length ? `Current cycle: ${cycles.join("; ")}` : "No cycle is active right now.",
    ...(calendar.length ? [`Cycles: ${calendar.join("; ")}`] : []),
    ordered.length < rows.length ? `Showing ${ordered.length} of ${rows.length} tickets (current cycle and open work first).` : `${rows.length} tickets.`,
    "Format: code · title · status · cycle · priority · assignee · due date · type",
  ];
  return [...header, ...ordered.map(ticketLine)].join("\n");
}

// ── The answer's language ───────────────────────────────────────────────────
const LANGUAGE_RULE =
  "- Language: always write answer in English, whatever language the question, the project information above or these instructions are in, also when found is false. Quote names, ticket titles, messages and codes as they appear (a title in another language stays as it is), but write everything else in English.";

const STATUS_QUESTION_PATTERNS: RegExp[] = [
  /\bcycles?\b/i, /\bsprints?\b/i, /\bwhen\b/i, /\bdeploy/i, /\brelease/i, /\bship(ped|ping)?\b/i, /\blaunch/i,
  /\bstatus\b/i, /\bpriorit/i, /\bdue\b/i, /\bdeadline/i, /\beta\b/i, /\bdone\b/i, /\bfinish/i, /\bready\b/i,
  /\bprogress\b/i, /\bschedul/i, /\bwho('s| is)? (working|assigned)/i, /\bassign/i,
];

export function isTicketStatusQuestion(question: string): boolean {
  return STATUS_QUESTION_PATTERNS.some((pattern) => pattern.test(question));
}

function statusQuestionRules(today: string): string {
  return `
This question is about where some work stands (its status, cycle, priority, dates or who has it). For this kind of question:
- First find the ticket(s) it's about. People name the feature, not its code: match what the question mentions against the ticket titles in the ticket list (and the issues in the numbered information) by meaning, not exact words — e.g. "the SSO feature" matches "Login with SSO", "the query feature" matches "In the dashboard, add a global query". If more than one ticket matches, answer for each, briefly. If none clearly matches, set found to false and say no ticket in this project matches, naming what you looked for.
- Put the ticket's code and title in title (e.g. "SPA-582 — Global query"), then answer exactly what was asked from that ticket's line: its status, its cycle (with the cycle's dates from the "Cycles" line), its priority, its due date, who it's assigned to.
- "When will it be done / deployed / released / ready?": there's no deployment date field, so go in this order and say which one you used:
  1. Its status is Done, Approved, Canceled or another finished one → say it's already finished (don't give a future date).
  2. It has a due date → that date.
  3. It's in a cycle → it's planned for that cycle: give the cycle's end date as the expected date, and say it's an estimate from the cycle, not a promised date. If that cycle is past and the ticket is still open, say it didn't make it in that cycle and is still in progress.
  4. Neither → say it has no date or cycle planned yet, and give its current status.
- Never invent a date, cycle, priority or person that isn't in the lines above. Today is ${today}: you can say how far away a date is, or that it's overdue.`;
}

// ── The prompt ──────────────────────────────────────────────────────────────

// Each source is numbered ([1], [2]…) so the answer can cite them by number;
// tickets from the ticket list are cited by code.
const projectLabel = (name?: string | null) => (name ?? "").replace(/["\r\n]+/g, " ").trim().slice(0, 100);

// `projectName`: the project the information below belongs to, so a question
// about another one ("how many tickets does Acme have?") is turned away
// instead of answered with this project's data under the other name. The
// data itself is already this project's only (scoped in SQL / by the
// ticket system, and the caller's access checked), so this is about not
// misleading, not about access.
export function buildAskPrompt(question: string, sources: Source[], tickets = "", projectName?: string | null): string {
  const project = projectLabel(projectName);
  const today = new Date().toISOString().slice(0, 10);
  const blocks = sources
    .map((source, i) => `[${i + 1}] ${sourceHeading(source)}\n${clip(source.content)}`)
    .join("\n\n");

  const sections = [
    tickets && `Ticket list (live from the ticket system, as of ${today}):\n\n${tickets}`,
    blocks && `Project information that matches the question (documents, test cases and issues):\n\n${blocks}`,
  ].filter(Boolean);

  // Only with the ticket list: without it there's nothing to answer these from.
  const statusRules = tickets && isTicketStatusQuestion(question) ? `\n${statusQuestionRules(today)}` : "";
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
- In title, a short heading for the answer: 3 to 8 words, no period at the end (e.g. "Login with SSO — what's left"). Empty when found is false.
- In answer, bullet points in Markdown: each line starts with "- ", one fact per point, 2 to 6 points, each a short sentence. Bold (**…**) only the key value of a point, such as a status, a date or a number. No heading, intro sentence or closing paragraph around the points: the title is shown above them. When found is false, answer is one plain sentence instead, without bullets.
- In sources, list only the numbers (1, 2…) of the numbered items your answer relies on, as integers — never ticket codes; tickets from the ticket list go in tickets. Empty when the answer comes only from the ticket list.
- In answer, end each point that comes from a numbered item with its number(s), like "[2]" or "[1][3]". A point from the ticket list gets no marker: name the ticket by its code instead, and never put a code in brackets (not "[SPA-456]"). Don't add a "Sources" line at the end: the sources are listed below the answer.
- In tickets, list the codes (e.g. "SPA-456") of the tickets from the ticket list your answer is about, and only those.
- When you mention an issue, document or test case in the answer, name it the way it appears above (e.g. "Issue SPA-456").${statusRules}
${LANGUAGE_RULE}

Question: ${question}

Answer in English.`;
}

// A "Sources: [1], [2]" line the AI sometimes still ends the answer with (in
// any of the usual spellings), and the [n] markers in it: the page shows the
// sources below the answer, so they'd only repeat. The answer's own text
// is left as it is.
const SOURCES_LINE_RE = /\n*[ \t]*\(?sources?[ \t]*:?[ \t]*(?:\[\d+\][ \t,;&and]*)+\)?\.?[ \t]*$/i;

export function withoutSourcesLine(answer: string): string {
  return answer.replace(SOURCES_LINE_RE, "").trim();
}

// The AI's reply, as the JSON schema asks for it.
export type AskReply = { found: boolean; title?: string; answer: string; sources: (number | string)[]; tickets?: string[] };

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

// The numbers the answer cites: those in `sources`, then any [n] used in the
// text but left out of it, in that order; out of range or repeated dropped.
export function citedNumbers(reply: AskReply, count: number): number[] {
  const inText = [...(reply.answer ?? "").matchAll(/\[([\d\s,;]+)\]/g)].flatMap((m) =>
    m[1]!.split(/[,;]/).map((n) => Number(n.trim())),
  );
  const seen = new Set<number>();
  // A number sent as a string ("2") counts; a ticket code ("SPA-456") doesn't.
  const listed = (reply.sources ?? []).map((n) => (typeof n === "string" && /^\s*\d+\s*$/.test(n) ? Number(n) : n));
  for (const n of [...listed, ...inText]) {
    if (typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= count) seen.add(n);
  }
  return [...seen];
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The answer's [n] markers renumbered to the sources as the page lists them
// (`cited[i]` is the prompt's number of the source shown as i + 1; markers for
// anything not shown are dropped), and a marker added after the first mention
// of each listed ticket's code (`codes[i]`, display order) that has none yet —
// tickets from the ticket list are cited by code, not by number.
export function numberCitations(answer: string, cited: number[], codes: (string | null | undefined)[]): string {
  // A ticket code in brackets ("[SPA-456]", which the AI sometimes writes
  // despite the prompt) becomes that ticket's number when it's listed, else
  // goes; a code written that way is still named elsewhere in the point.
  // Numbers first, so the ones the codes become aren't renumbered again.
  let text = answer.replace(/[ \t]*\[([\d\s,;]+)\]/g, (_, list: string) => {
    const shown = [...new Set(list.split(/[,;]/).map((n) => cited.indexOf(Number(n.trim())) + 1).filter((n) => n > 0))];
    return shown.length ? ` ${shown.map((n) => `[${n}]`).join("")}` : "";
  });
  const upper = codes.map((c) => c?.toUpperCase());
  text = text.replace(/[ \t]*\[([A-Za-z][A-Za-z0-9]*-\d+)\]/g, (_, code: string) => {
    const i = upper.indexOf(code.toUpperCase());
    return i >= 0 ? ` [${i + 1}]` : "";
  });
  codes.forEach((code, i) => {
    const marker = `[${i + 1}]`;
    if (!code || text.includes(marker)) return;
    const mention = new RegExp(`\\b${escapeRegExp(code)}\\b(\\*\\*)?(?!\\s*\\[)`, "i");
    text = text.replace(mention, (found) => `${found} ${marker}`);
  });
  return text;
}

// The cited sources, by the AI's 1-based numbers; anything out of range or
// repeated is dropped.
export function citedSources<T>(reply: AskReply, sources: T[]): T[] {
  return citedNumbers(reply, sources.length).map((n) => sources[n - 1]!);
}
