// @ts-nocheck
// pgvector-backed half of the vector store — the "instead of upstash" path
// from customers.systems.vector = 'pgvector'. Routed to from vector.ts,
// which is still the only file anything outside lib/ ever imports from; see
// that file for why nothing else needed to change.
//
// Embeddings come from Supabase Edge Functions' built-in `Supabase.ai`
// runtime (the "gte-small" model, 384 dimensions) — no external embedding
// API or key, matching "Supabase has built in vector support" in the
// ticket. Only available when actually running as a deployed/served edge
// function (the `Supabase` global doesn't exist under `supabase functions
// serve` in some older CLI versions or a plain `deno run`), so embedText
// throws a clear error rather than a confusing "Supabase is not defined" if
// that's ever hit.
import { supabase } from "../client.ts";
import type { VectorMatch } from "./vector.ts";

let embeddingSession: any = null;

async function embedText(text: string): Promise<number[]> {
  if (typeof Supabase === "undefined" || !Supabase.ai) {
    throw new Error("Supabase.ai embedding runtime isn't available in this environment");
  }
  embeddingSession ??= new Supabase.ai.Session("gte-small");
  const embedding = await embeddingSession.run(text, { mean_pool: true, normalize: true });
  return Array.from(embedding);
}

// ─── Documents ───────────────────────────────────────────────────────────

export async function upsertDocumentVectorPg(
  namespace: string,
  doc: { id: number | string; file_name: string; category?: string | null; content?: string | null },
): Promise<boolean> {
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
    console.error("[upsertDocumentVectorPg] failed (non-fatal):", err);
    return false;
  }
}

export async function deleteDocumentVectorsPg(ids: (number | string)[]): Promise<boolean> {
  if (ids.length === 0) return true;
  try {
    const { error } = await supabase.schema("portal")
      .from("documents")
      .update({ embedding: null })
      .in("id", ids);
    if (error) throw new Error(error.message);
    return true;
  } catch (err) {
    console.error("[deleteDocumentVectorsPg] failed (non-fatal):", err);
    return false;
  }
}

export async function queryTopDocumentMatchesPg(
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
    console.error("[queryTopDocumentMatchesPg] failed:", err);
    return [];
  }
}

// ─── Issues ──────────────────────────────────────────────────────────────

const TITLE_ONLY_QUERY_MAX_LENGTH = 15;

export async function upsertIssueVectorPg(
  namespace: string,
  issue: { id: string; title: string; description?: string | null; kind?: "bug" | "feature" | null },
): Promise<boolean> {
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
    console.error("[upsertIssueVectorPg] failed (non-fatal):", err);
    return false;
  }
}

export async function deleteIssueVectorsPg(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  try {
    const { error } = await supabase.schema("portal").from("issue_vectors").delete().in("id", ids);
    if (error) throw new Error(error.message);
    return true;
  } catch (err) {
    console.error("[deleteIssueVectorsPg] failed (non-fatal):", err);
    return false;
  }
}

export async function queryTopIssueMatchesPg(
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
    console.error("[queryTopIssueMatchesPg] failed:", err);
    return [];
  }
}

// ─── Test cases ──────────────────────────────────────────────────────────

export async function upsertTestVectorPg(
  namespace: string,
  test: { id: string; title: string; steps: { order: number; description: string }[] },
): Promise<void> {
  try {
    const stepsText = (test.steps ?? []).map((s) => s.description).join("\n");
    const text = [test.title, stepsText].filter(Boolean).join("\n\n");
    const embedding = await embedText(text);
    const { error } = await supabase.schema("portal")
      .from("tests")
      .update({ embedding: JSON.stringify(embedding) })
      .eq("id", test.id);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("[upsertTestVectorPg] failed (non-fatal):", err);
  }
}

export async function queryTopTestMatchesPg(
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
    console.error("[queryTopTestMatchesPg] failed:", err);
    return [];
  }
}
