// @ts-nocheck
// Vector search for issues, test cases and documents, backed by pgvector.
//
// Every object is split into chunks (lib/chunking.ts) and each chunk is
// embedded on its own into portal.embeddings
// (20261110120000_embeddings_table.sql), which points back at the object
// through document_id / test_id / issue_id. Searches go through
// portal.match_embeddings, which returns each object's best chunk.
//
// Embeddings use the built-in `Supabase.ai` runtime (gte-small, 384 dims), no
// external API. The `Supabase` global is missing under plain `deno run` or some
// older CLIs, so embedText throws a clear error in that case.
//
// `namespace` = the customer's linear_slug (documents/tests store it as
// project_slug). match_embeddings compares it with ilike, since stored casing
// is inconsistent.
//
// Best-effort: write failures are logged and reported as `false`, never
// thrown — a vector hiccup must not fail the write it's attached to. Queries
// return [] on failure.
import { supabase } from "../client.ts";
import { chunkObject, type Chunk } from "./chunking.ts";

export type VectorMatch = {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
};

let embeddingSession: any = null;

async function embedText(text: string): Promise<number[]> {
  if (typeof Supabase === "undefined" || !Supabase.ai) {
    throw new Error("Supabase.ai embedding runtime isn't available in this environment");
  }
  embeddingSession ??= new Supabase.ai.Session("gte-small");
  const embedding = await embeddingSession.run(text, { mean_pool: true, normalize: true });
  return Array.from(embedding);
}

// Exact label-name match (not substring), same as LABEL_ICONS in
// issue-cards.tsx, so `kind` always agrees with the icon the UI renders.
export function deriveIssueKind(
  labels?: { name?: string | null }[] | null,
): "bug" | "feature" | null {
  const names = new Set((labels ?? []).map((l) => l.name?.toLowerCase()));
  if (names.has("bug")) return "bug";
  if (names.has("feature")) return "feature";
  return null;
}

// ─── Chunks ──────────────────────────────────────────────────────────────

type SourceKey = { document_id: number | string } | { test_id: string } | { issue_id: string };

// A function call has ~2 s of CPU; gte-small gets through about 1,000 words
// in that (measured on the local stack, which has the cloud's limit), fewer
// on a cold start while the model loads. This is how many words one call
// embeds; an object that needs more is finished by later calls.
export const EMBED_WORDS_PER_CALL = 800;

const wordsIn = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export type ChunkSyncResult = {
  // Every chunk of the object is embedded and up to date.
  complete: boolean;
  // Words embedded by this call (0 when nothing had changed).
  wordsUsed: number;
};

// Brings an object's stored chunks in line with `chunks`, embedding only
// what changed: a chunk whose text is already stored keeps its vector, chunks
// past the new end are removed, and new or changed ones are embedded in
// order until `budgetWords` runs out (always at least one, so every call
// makes progress). Whatever didn't fit is left for the next call.
async function syncChunks(
  source: SourceKey,
  projectSlug: string,
  chunks: Chunk[],
  budgetWords = EMBED_WORDS_PER_CALL,
): Promise<ChunkSyncResult> {
  const [column, value] = Object.entries(source)[0];
  const table = () => supabase.schema("portal").from("embeddings");

  const { data: stored, error: readError } = await table().select("chunk_index, content").eq(column, value);
  if (readError) throw new Error(readError.message);
  const storedText = new Map((stored ?? []).map((row: any) => [row.chunk_index, row.content]));

  // Chunks past the new end (the text got shorter).
  if ((stored ?? []).some((row: any) => row.chunk_index >= chunks.length)) {
    const { error } = await table().delete().eq(column, value).gte("chunk_index", chunks.length);
    if (error) throw new Error(error.message);
  }

  const changed = chunks.filter((chunk) => storedText.get(chunk.index) !== chunk.text);
  const rows = [];
  let wordsUsed = 0;
  for (const chunk of changed) {
    const words = wordsIn(chunk.text);
    if (rows.length > 0 && wordsUsed + words > budgetWords) {
      break;
    }
    // One at a time: each is a run of the model in this function's worker.
    rows.push({
      ...source,
      project_slug: projectSlug,
      chunk_index: chunk.index,
      content: chunk.text,
      embedding: JSON.stringify(await embedText(chunk.text)),
    });
    wordsUsed += words;
  }

  if (rows.length) {
    // Embedded first, then swapped in: the old rows for these chunks go and
    // the new ones come in (the partial unique indexes rule out an upsert).
    const { error: deleteError } = await table().delete().eq(column, value).in(
      "chunk_index",
      rows.map((row) => row.chunk_index),
    );
    if (deleteError) throw new Error(deleteError.message);
    const { error: insertError } = await table().insert(rows);
    if (insertError) throw new Error(insertError.message);
  }

  return { complete: rows.length === changed.length, wordsUsed };
}

// Records whether all of a document's or test's chunks are embedded, so the
// backfill knows which ones to finish.
async function markComplete(tableName: "documents" | "tests", id: number | string, complete: boolean) {
  const { error } = await supabase.schema("portal").from(tableName).update({ embeddings_complete: complete }).eq("id", id);
  if (error) throw new Error(error.message);
}

type MatchOptions = {
  sourceTypes: ("document" | "test" | "issue")[];
  titleOnly?: boolean;
  issueKind?: "bug" | "feature" | null;
  count: number;
};

// Each matching object's best chunk, best first.
async function matchChunks(namespace: string, queryText: string, options: MatchOptions) {
  const embedding = await embedText(queryText);
  const { data, error } = await supabase.schema("portal").rpc("match_embeddings", {
    query_embedding: JSON.stringify(embedding),
    match_project_slug: namespace,
    match_source_types: options.sourceTypes,
    match_title_only: options.titleOnly ?? false,
    match_issue_kind: options.issueKind ?? null,
    match_count: options.count,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── Issues ──────────────────────────────────────────────────────────────
// Issues live in Linear: portal.issue_vectors mirrors them (title, kind and
// what the global query cites), and their chunks point at that row. Chunk 0
// is the title alone; the rest are title + description.

type IssueVectorInput = {
  id: string;
  title: string;
  description?: string | null;
  // Lets the similar-issues hint show the right icon without fetching the issue.
  kind?: "bug" | "feature" | null;
  // Optional: callers that have them pass them; others leave what's stored.
  identifier?: string | null;
  state?: string | null;
  dueDate?: string | null;
  createdAt?: string | null;
};

// Short queries (e.g. "roadmap") embed closer to short titles than to long
// title+description chunks and missed real hits, so below this length we
// match against the titles (chunk 0) only.
const TITLE_ONLY_QUERY_MAX_LENGTH = 15;

export async function upsertIssueVector(namespace: string, issue: IssueVectorInput): Promise<boolean> {
  try {
    const { error } = await supabase.schema("portal")
      .from("issue_vectors")
      .upsert({
        id: issue.id,
        project_slug: namespace,
        title: issue.title,
        kind: issue.kind ?? null,
        ...(issue.identifier !== undefined && { identifier: issue.identifier }),
        ...(issue.state !== undefined && { state: issue.state }),
        ...(issue.dueDate !== undefined && { due_date: issue.dueDate }),
        ...(issue.createdAt !== undefined && { linear_created_at: issue.createdAt }),
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);

    const chunks = chunkObject({ title: issue.title, body: issue.description, titleChunk: true });
    const { complete } = await syncChunks({ issue_id: issue.id }, namespace, chunks);
    // An unfinished issue reports false, so linear-vector-sync keeps its
    // checkpoint and the next run embeds the rest.
    return complete;
  } catch (err) {
    console.error("[upsertIssueVector] failed (non-fatal):", err);
    return false;
  }
}

// Used by linear-vector-sync to drop tickets trashed in Linear. Their chunks
// go with them (on delete cascade). Returns success so the sync can avoid
// advancing its checkpoint on failure.
export async function deleteIssueVectors(_namespace: string, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  try {
    const { error } = await supabase.schema("portal").from("issue_vectors").delete().in("id", ids);
    if (error) throw new Error(error.message);
    return true;
  } catch (err) {
    console.error("[deleteIssueVectors] failed (non-fatal):", err);
    return false;
  }
}

// `kind` scopes results to bugs or features; omit to search both.
export async function queryTopIssueMatches(
  namespace: string,
  queryText: string,
  topK = 3,
  kind?: "bug" | "feature",
): Promise<VectorMatch[]> {
  try {
    const rows = await matchChunks(namespace, queryText, {
      sourceTypes: ["issue"],
      titleOnly: queryText.trim().length < TITLE_ONLY_QUERY_MAX_LENGTH,
      issueKind: kind ?? null,
      count: topK,
    });
    if (rows.length === 0) return [];

    const { data: issues, error } = await supabase.schema("portal")
      .from("issue_vectors")
      .select("id, title, kind")
      .in("id", rows.map((r: any) => r.issue_id));
    if (error) throw new Error(error.message);
    const byId = new Map((issues ?? []).map((i: any) => [i.id, i]));

    return rows.map((row: any) => {
      const issue = byId.get(row.issue_id);
      return {
        id: row.issue_id,
        score: row.similarity,
        metadata: { ticket_id: row.issue_id, title: issue?.title, ...(issue?.kind ? { kind: issue.kind } : {}) },
      };
    });
  } catch (err) {
    console.error("[queryTopIssueMatches] failed:", err);
    return [];
  }
}

// ─── Test cases ──────────────────────────────────────────────────────────
// Title + steps, chunked; the chunks point at portal.tests.

type TestVectorInput = { id: string; title: string; steps: { order: number; description: string }[] };

// Embeds a test's chunks within `budgetWords`, and records on the test
// whether they're all done. For the backfill, which shares one budget across
// a batch; everyone else uses upsertTestVector.
export async function embedTest(namespace: string, test: TestVectorInput, budgetWords = EMBED_WORDS_PER_CALL) {
  const stepsText = (test.steps ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s) => s.description)
    .join("\n");
  const chunks = chunkObject({ title: test.title, body: stepsText });
  const result = await syncChunks({ test_id: test.id }, namespace, chunks, budgetWords);
  await markComplete("tests", test.id, result.complete);
  return result;
}

export async function upsertTestVector(namespace: string, test: TestVectorInput): Promise<boolean> {
  try {
    await embedTest(namespace, test);
    return true;
  } catch (err) {
    console.error("[upsertTestVector] failed (non-fatal):", err);
    return false;
  }
}

export async function queryTopTestMatches(
  namespace: string,
  queryText: string,
  topK = 3,
): Promise<VectorMatch[]> {
  try {
    const rows = await matchChunks(namespace, queryText, { sourceTypes: ["test"], count: topK });
    if (rows.length === 0) return [];

    const { data: tests, error } = await supabase.schema("portal")
      .from("tests")
      .select("id, title")
      .in("id", rows.map((r: any) => r.test_id));
    if (error) throw new Error(error.message);
    const titleById = new Map((tests ?? []).map((t: any) => [t.id, t.title]));

    return rows.map((row: any) => ({
      id: row.test_id,
      score: row.similarity,
      metadata: { test_id: row.test_id, name: titleById.get(row.test_id) },
    }));
  } catch (err) {
    console.error("[queryTopTestMatches] failed:", err);
    return [];
  }
}

// ─── Documents ───────────────────────────────────────────────────────────
// File name (as the title) + category + content, chunked; the chunks point
// at portal.documents. `content` is only set for plain-text formats
// (md/txt/csv/mmd) and Word (.docx) — see extractDocumentText in
// utils/documentText.ts; pdf/images are embedded from file_name + category only.

type DocumentVectorInput = {
  id: number | string;
  file_name: string;
  category?: string | null;
  content?: string | null;
};

// Embeds a document's chunks within `budgetWords`, and records on the
// document whether they're all done (a long one is finished by later calls of
// the backfill). For the backfill, which shares one budget across a batch;
// everyone else uses upsertDocumentVector.
export async function embedDocument(
  namespace: string,
  doc: DocumentVectorInput,
  budgetWords = EMBED_WORDS_PER_CALL,
): Promise<ChunkSyncResult> {
  const body = [doc.category, doc.content].filter(Boolean).join("\n\n");
  const chunks = chunkObject({ title: doc.file_name, body });
  const result = await syncChunks({ document_id: doc.id }, namespace, chunks, budgetWords);
  await markComplete("documents", doc.id, result.complete);
  return result;
}

// On upload: the first chunks right away (so the document is searchable at
// once); a long document's rest is left to the backfill. `true` = no error,
// whether or not it finished.
export async function upsertDocumentVector(namespace: string, doc: DocumentVectorInput): Promise<boolean> {
  try {
    await embedDocument(namespace, doc);
    return true;
  } catch (err) {
    console.error("[upsertDocumentVector] failed (non-fatal):", err);
    return false;
  }
}

// Deleting the document row already removes its chunks (on delete cascade);
// this is for callers that remove the chunks while keeping the row.
export async function deleteDocumentVectors(_namespace: string, ids: (number | string)[]): Promise<boolean> {
  if (ids.length === 0) return true;
  try {
    const { error } = await supabase.schema("portal")
      .from("embeddings")
      .delete()
      .in("document_id", ids);
    if (error) throw new Error(error.message);
    return true;
  } catch (err) {
    console.error("[deleteDocumentVectors] failed (non-fatal):", err);
    return false;
  }
}

export async function queryTopDocumentMatches(
  namespace: string,
  queryText: string,
  topK = 20,
): Promise<VectorMatch[]> {
  try {
    const rows = await matchChunks(namespace, queryText, { sourceTypes: ["document"], count: topK });
    return rows.map((row: any) => ({ id: String(row.document_id), score: row.similarity }));
  } catch (err) {
    console.error("[queryTopDocumentMatches] failed:", err);
    return [];
  }
}
