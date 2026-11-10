// The global query's prompt (SPA-582): a client's question answered only
// from that client's stored documents, test cases and issues. The sources
// come from portal.embeddings (each object's best-matching chunk); this file
// only decides which of them are relevant enough and how they're written into
// the prompt. No imports, so the unit tests load it directly
// (tests/unit/ask.spec.ts).

// gte-small scores unrelated text around 0.8 (see issues' SIMILARITY_THRESHOLD),
// so anything below this isn't worth showing the AI. When nothing reaches it,
// the answer is "not found" without calling the AI at all.
export const MIN_SIMILARITY = 0.8;
export const MAX_SOURCES = 10;
// Per source, as the ticket asks: enough context without flooding the prompt.
export const MAX_CONTENT_CHARS = 2000;
export const MAX_QUESTION_LENGTH = 500;

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

// Each source is numbered ([1], [2]…) so the answer can cite them by number.
export function buildAskPrompt(question: string, sources: Source[]): string {
  const blocks = sources
    .map((source, i) => `[${i + 1}] ${sourceHeading(source)}\n${clip(source.content)}`)
    .join("\n\n");

  return `You answer questions about one software project for the people working on it, using ONLY the project information below: its documents, test cases and issues (tickets).

Project information:

${blocks}

Rules:
- Answer only from the information above. Don't use outside knowledge and don't guess. If it doesn't contain the answer, set found to false and say briefly, in answer, that the project's documents, tests and issues don't cover it.
- Plain text, short and direct: a few sentences, or a short list when the question asks for several things.
- In sources, list the numbers ([1], [2]…) of every item your answer relies on, and only those.
- When you mention an issue, document or test case in the answer, name it the way it appears above (e.g. "Issue SPA-456").
- Write the answer in the same language as the question.

Question: ${question}

Answer in the same language as the question above.`;
}

// The AI's reply, as the JSON schema asks for it.
export type AskReply = { found: boolean; answer: string; sources: number[] };

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
