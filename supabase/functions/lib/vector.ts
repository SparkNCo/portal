// @ts-nocheck
// Vector search for issues, test cases and documents, backed by pgvector
// (20260923100000_add_pgvector_support.sql).
//
// Embeddings use the built-in `Supabase.ai` runtime (gte-small, 384 dims), no
// external API. The `Supabase` global is missing under plain `deno run` or some
// older CLIs, so embedText throws a clear error in that case.
//
// `namespace` = the customer's linear_slug (documents/tests store it as
// project_slug). The match_* RPCs compare it with ilike, since stored casing
// is inconsistent.
//
// Best-effort: write failures are logged and reported as `false`, never
// thrown — a vector hiccup must not fail the write it's attached to. Queries
// return [] on failure.
import { supabase } from "../client.ts";

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

// ─── Issues ──────────────────────────────────────────────────────────────
// Issues live in Linear, so they get their own index table (portal.issue_vectors),
// with two embeddings per issue: title-only and title+description.

type IssueVectorInput = {
  id: string;
  title: string;
  description?: string | null;
  // Lets the similar-issues hint show the right icon without fetching the issue.
  kind?: "bug" | "feature" | null;
};

// Short queries (e.g. "roadmap") embed closer to short titles than to long
// title+description vectors and missed real hits, so below this length we
// match against the title-only embedding instead.
const TITLE_ONLY_QUERY_MAX_LENGTH = 15;

export async function upsertIssueVector(namespace: string, issue: IssueVectorInput): Promise<boolean> {
  try {
    const combinedText = [issue.title, issue.description].filter(Boolean).join("\n\n");
    const [titleEmbedding, combinedEmbedding] = await Promise.all([
      embedText(issue.title),
      embedText(combinedText),
    ]);
    const { error } = await supabase.schema("portal")
      .from("issue_vectors")
      .upsert({
        id: issue.id,
        project_slug: namespace,
        title: issue.title,
        kind: issue.kind ?? null,
        title_embedding: JSON.stringify(titleEmbedding),
        combined_embedding: JSON.stringify(combinedEmbedding),
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    return true;
  } catch (err) {
    console.error("[upsertIssueVector] failed (non-fatal):", err);
    return false;
  }
}

// Used by linear-vector-sync to drop tickets trashed in Linear. Returns
// success so the sync can avoid advancing its checkpoint on failure.
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
    const useTitleOnly = queryText.trim().length < TITLE_ONLY_QUERY_MAX_LENGTH;
    const embedding = await embedText(queryText);
    const { data, error } = await supabase.schema("portal").rpc("match_issues", {
      query_embedding: JSON.stringify(embedding),
      match_project_slug: namespace,
      match_kind: kind ?? null,
      use_title_only: useTitleOnly,
      match_count: topK,
    });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => ({
      id: row.id,
      score: row.similarity,
      metadata: { ticket_id: row.id, title: row.title, ...(row.kind ? { kind: row.kind } : {}) },
    }));
  } catch (err) {
    console.error("[queryTopIssueMatches] failed:", err);
    return [];
  }
}

// ─── Test cases ──────────────────────────────────────────────────────────
// Stored on portal.tests.embedding.

type TestVectorInput = { id: string; title: string; steps: { order: number; description: string }[] };

export async function upsertTestVector(_namespace: string, test: TestVectorInput): Promise<boolean> {
  try {
    const stepsText = (test.steps ?? []).map((s) => s.description).join("\n");
    const text = [test.title, stepsText].filter(Boolean).join("\n\n");
    const embedding = await embedText(text);
    const { error } = await supabase.schema("portal")
      .from("tests")
      .update({ embedding: JSON.stringify(embedding) })
      .eq("id", test.id);
    if (error) throw new Error(error.message);
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
    const embedding = await embedText(queryText);
    const { data, error } = await supabase.schema("portal").rpc("match_tests", {
      query_embedding: JSON.stringify(embedding),
      match_project_slug: namespace,
      match_count: topK,
    });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => ({
      id: row.id,
      score: row.similarity,
      metadata: { test_id: row.id, name: row.title },
    }));
  } catch (err) {
    console.error("[queryTopTestMatches] failed:", err);
    return [];
  }
}

// ─── Documents ───────────────────────────────────────────────────────────
// Stored on portal.documents.embedding. `content` is only set for plain-text
// formats (md/txt/csv/mmd) and Word (.docx) — see extractDocumentText in
// utils/documentText.ts; pdf/images are embedded from file_name + category only.

type DocumentVectorInput = {
  id: number | string;
  file_name: string;
  category?: string | null;
  content?: string | null;
};

export async function upsertDocumentVector(_namespace: string, doc: DocumentVectorInput): Promise<boolean> {
  try {
    const text = [doc.file_name, doc.category, doc.content].filter(Boolean).join("\n\n");
    const embedding = await embedText(text);
    const { error } = await supabase.schema("portal")
      .from("documents")
      .update({ embedding: JSON.stringify(embedding) })
      .eq("id", doc.id);
    if (error) throw new Error(error.message);
    return true;
  } catch (err) {
    console.error("[upsertDocumentVector] failed (non-fatal):", err);
    return false;
  }
}

export async function deleteDocumentVectors(_namespace: string, ids: (number | string)[]): Promise<boolean> {
  if (ids.length === 0) return true;
  try {
    const { error } = await supabase.schema("portal")
      .from("documents")
      .update({ embedding: null })
      .in("id", ids);
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
    const embedding = await embedText(queryText);
    const { data, error } = await supabase.schema("portal").rpc("match_documents", {
      query_embedding: JSON.stringify(embedding),
      match_project_slug: namespace,
      match_count: topK,
    });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => ({ id: String(row.id), score: row.similarity }));
  } catch (err) {
    console.error("[queryTopDocumentMatches] failed:", err);
    return [];
  }
}
