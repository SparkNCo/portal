// @ts-nocheck
// Every export routes to the customer's vector provider (customers.systems.vector:
// 'upstash' | 'pgvector', see vectorProvider.ts). Callers never see the split.
import { resolveVectorProvider } from "./vectorProvider.ts";
import {
  upsertDocumentVectorPg,
  deleteDocumentVectorsPg,
  queryTopDocumentMatchesPg,
  upsertIssueVectorPg,
  deleteIssueVectorsPg,
  queryTopIssueMatchesPg,
  upsertTestVectorPg,
  queryTopTestMatchesPg,
} from "./pgvectorClient.ts";

// Upstash: one index shared by issues, tests and documents, kept apart by
// `metadata.type` — every query must filter on it. The index uses Upstash's hosted
// embedding model (created manually in the console); we only send raw text to the
// "-data" endpoints.
//
// Namespace = customer's linear_slug. Vector id = source row id, so re-upserts
// overwrite in place.
//
// Best-effort: failures are logged, never thrown — a vector hiccup must not fail
// the write it's attached to.

export type VectorMatch = {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
};

async function upstashRequest(
  baseUrl: string,
  token: string,
  path: string,
  body: unknown,
  method: string = "POST",
): Promise<any> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`Upstash Vector error (${path}): ${json.error ?? res.statusText}`);
  }
  return json.result;
}

function vectorIndex() {
  return {
    url: Deno.env.get("UPSTASH_VECTOR_REST_URL")!,
    token: Deno.env.get("UPSTASH_VECTOR_REST_TOKEN")!,
  };
}

// Slugs are stored with inconsistent casing across the app, and Upstash
// namespaces are case-sensitive — normalize so upserts and queries always
// land in the same namespace.
function normalizeNamespace(namespace: string): string {
  return namespace.trim().toLowerCase();
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

// Used by linear-vector-sync to drop tickets trashed in Linear. Returns
// success so the sync can avoid advancing its checkpoint on failure —
// otherwise the trashed issue ages out of the next `since` window and its
// stale vector is never retried.
async function deleteIssueVectorsUpstash(namespace: string, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  try {
    const { url, token } = vectorIndex();
    // Each issue has two vectors (combined + "::title"); remove both.
    const allIds = ids.flatMap((id) => [id, `${id}::title`]);
    await upstashRequest(
      url,
      token,
      `/delete/${normalizeNamespace(namespace)}`,
      { ids: allIds },
      "DELETE",
    );
    return true;
  } catch (err) {
    console.error("[deleteIssueVectors] failed (non-fatal):", err);
    return false;
  }
}

export async function deleteIssueVectors(namespace: string, ids: string[]): Promise<boolean> {
  const provider = await resolveVectorProvider(namespace);
  return provider === "pgvector"
    ? deleteIssueVectorsPg(ids)
    : deleteIssueVectorsUpstash(namespace, ids);
}

type IssueVectorInput = {
  id: string;
  title: string;
  description?: string | null;
  // Lets the similar-issues hint show the right icon without fetching the issue.
  kind?: "bug" | "feature" | null;
};

async function upsertIssueVectorUpstash(
  namespace: string,
  issue: IssueVectorInput,
): Promise<boolean> {
  try {
    const { url, token } = vectorIndex();
    const ns = normalizeNamespace(namespace);
    const combinedData = [issue.title, issue.description].filter(Boolean).join("\n\n");
    const baseMetadata = {
      ticket_id: issue.id,
      title: issue.title,
      ...(issue.kind ? { kind: issue.kind } : {}),
    };

    // Two vectors per issue: title+description, and title-only ("::title",
    // see TITLE_ONLY_QUERY_MAX_LENGTH). Sequential on purpose — parallel
    // upserts during linear-vector-sync's bulk runs got Upstash throttling us
    // ("vector store backend is currently unavailable").
    await upstashRequest(url, token, `/upsert-data/${ns}`, {
      id: issue.id,
      data: combinedData,
      metadata: { type: "issue", ...baseMetadata },
    });
    await upstashRequest(url, token, `/upsert-data/${ns}`, {
      id: `${issue.id}::title`,
      data: issue.title,
      metadata: { type: "issue-title", ...baseMetadata },
    });
    return true;
  } catch (err) {
    console.error("[upsertIssueVector] failed (non-fatal):", err);
    return false;
  }
}

export async function upsertIssueVector(namespace: string, issue: IssueVectorInput): Promise<boolean> {
  const provider = await resolveVectorProvider(namespace);
  return provider === "pgvector"
    ? upsertIssueVectorPg(namespace, issue)
    : upsertIssueVectorUpstash(namespace, issue);
}

async function upsertTestVectorUpstash(
  namespace: string,
  test: { id: string; title: string; steps: { order: number; description: string }[] },
): Promise<void> {
  try {
    const { url, token } = vectorIndex();
    const stepsText = (test.steps ?? []).map((s) => s.description).join("\n");
    const data = [test.title, stepsText].filter(Boolean).join("\n\n");
    await upstashRequest(url, token, `/upsert-data/${normalizeNamespace(namespace)}`, {
      id: test.id,
      data,
      metadata: { type: "test-case", test_id: test.id, name: test.title },
    });
  } catch (err) {
    console.error("[upsertTestVector] failed (non-fatal):", err);
  }
}

type TestVectorInput = { id: string; title: string; steps: { order: number; description: string }[] };

export async function upsertTestVector(namespace: string, test: TestVectorInput): Promise<void> {
  const provider = await resolveVectorProvider(namespace);
  if (provider === "pgvector") {
    await upsertTestVectorPg(namespace, test);
  } else {
    await upsertTestVectorUpstash(namespace, test);
  }
}

// Short queries (e.g. "roadmap") embed closer to short titles than to long
// title+description vectors and missed real hits, so below this length we
// match against the title-only vectors instead.
const TITLE_ONLY_QUERY_MAX_LENGTH = 15;

async function queryTopIssueMatchesUpstash(
  namespace: string,
  queryText: string,
  topK = 3,
  kind?: "bug" | "feature",
): Promise<VectorMatch[]> {
  try {
    const { url, token } = vectorIndex();
    const type = queryText.trim().length < TITLE_ONLY_QUERY_MAX_LENGTH ? "issue-title" : "issue";
    const filter = kind ? `type = '${type}' AND kind = '${kind}'` : `type = '${type}'`;
    const result = await upstashRequest(url, token, `/query-data/${normalizeNamespace(namespace)}`, {
      data: queryText,
      topK,
      includeMetadata: true,
      filter,
    });
    // Map "::title" ids back to the real issue id.
    return Array.isArray(result)
      ? result.map((m: VectorMatch) => ({ ...m, id: (m.metadata?.ticket_id as string) ?? m.id }))
      : [];
  } catch (err) {
    console.error("[queryTopIssueMatches] failed:", err);
    return [];
  }
}

// `kind` scopes results to bugs or features; omit to search both.
export async function queryTopIssueMatches(
  namespace: string,
  queryText: string,
  topK = 3,
  kind?: "bug" | "feature",
): Promise<VectorMatch[]> {
  const provider = await resolveVectorProvider(namespace);
  return provider === "pgvector"
    ? queryTopIssueMatchesPg(namespace, queryText, topK, kind)
    : queryTopIssueMatchesUpstash(namespace, queryText, topK, kind);
}

// Documents: vector id = String(documents.id). `content` is only set for
// plain-text formats (md/txt/csv/mmd); for pdf/docx/images we can't extract
// text here, so those are embedded from file_name + category only.
type DocumentVectorInput = {
  id: number | string;
  file_name: string;
  category?: string | null;
  content?: string | null;
};

async function upsertDocumentVectorUpstash(
  namespace: string,
  doc: DocumentVectorInput,
): Promise<boolean> {
  try {
    const { url, token } = vectorIndex();
    const data = [doc.file_name, doc.category, doc.content].filter(Boolean).join("\n\n");
    await upstashRequest(url, token, `/upsert-data/${normalizeNamespace(namespace)}`, {
      id: String(doc.id),
      data,
      metadata: { type: "document", document_id: String(doc.id), file_name: doc.file_name },
    });
    return true;
  } catch (err) {
    console.error("[upsertDocumentVector] failed (non-fatal):", err);
    return false;
  }
}

export async function upsertDocumentVector(namespace: string, doc: DocumentVectorInput): Promise<boolean> {
  const provider = await resolveVectorProvider(namespace);
  return provider === "pgvector"
    ? upsertDocumentVectorPg(namespace, doc)
    : upsertDocumentVectorUpstash(namespace, doc);
}

async function deleteDocumentVectorsUpstash(namespace: string, ids: (number | string)[]): Promise<boolean> {
  if (ids.length === 0) return true;
  try {
    const { url, token } = vectorIndex();
    await upstashRequest(
      url,
      token,
      `/delete/${normalizeNamespace(namespace)}`,
      { ids: ids.map(String) },
      "DELETE",
    );
    return true;
  } catch (err) {
    console.error("[deleteDocumentVectors] failed (non-fatal):", err);
    return false;
  }
}

export async function deleteDocumentVectors(namespace: string, ids: (number | string)[]): Promise<boolean> {
  const provider = await resolveVectorProvider(namespace);
  return provider === "pgvector"
    ? deleteDocumentVectorsPg(ids)
    : deleteDocumentVectorsUpstash(namespace, ids);
}

async function queryTopDocumentMatchesUpstash(
  namespace: string,
  queryText: string,
  topK = 20,
): Promise<VectorMatch[]> {
  try {
    const { url, token } = vectorIndex();
    const result = await upstashRequest(url, token, `/query-data/${normalizeNamespace(namespace)}`, {
      data: queryText,
      topK,
      includeMetadata: true,
      filter: "type = 'document'",
    });
    return Array.isArray(result) ? result : [];
  } catch (err) {
    console.error("[queryTopDocumentMatches] failed:", err);
    return [];
  }
}

export async function queryTopDocumentMatches(
  namespace: string,
  queryText: string,
  topK = 20,
): Promise<VectorMatch[]> {
  const provider = await resolveVectorProvider(namespace);
  return provider === "pgvector"
    ? queryTopDocumentMatchesPg(namespace, queryText, topK)
    : queryTopDocumentMatchesUpstash(namespace, queryText, topK);
}

async function queryTopTestMatchesUpstash(
  namespace: string,
  queryText: string,
  topK = 3,
): Promise<VectorMatch[]> {
  try {
    const { url, token } = vectorIndex();
    const result = await upstashRequest(url, token, `/query-data/${normalizeNamespace(namespace)}`, {
      data: queryText,
      topK,
      includeMetadata: true,
      filter: "type = 'test-case'",
    });
    return Array.isArray(result) ? result : [];
  } catch (err) {
    console.error("[queryTopTestMatches] failed:", err);
    return [];
  }
}

export async function queryTopTestMatches(
  namespace: string,
  queryText: string,
  topK = 3,
): Promise<VectorMatch[]> {
  const provider = await resolveVectorProvider(namespace);
  return provider === "pgvector"
    ? queryTopTestMatchesPg(namespace, queryText, topK)
    : queryTopTestMatchesUpstash(namespace, queryText, topK);
}
