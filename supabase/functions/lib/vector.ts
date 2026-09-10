// @ts-nocheck
// Upstash Vector client — a single hosted-embedding index shared by issues and test
// cases (was two separate indexes/accounts; merged to stay on Upstash's free tier).
// Each vector's `metadata.type` ("issue" | "test-case") is what keeps the two kinds
// apart — every query filters on it, per Upstash's metadata-filtering support
// (https://upstash.com/docs/vector/features/filtering), so an issue search can never
// surface a test case or vice versa despite sharing one index.
// The index is created manually in the Upstash console with a built-in embedding
// model (e.g. mxbai-embed-large-v1) — the app never computes embeddings itself, it
// just sends raw text via Upstash's "-data" endpoints and lets Upstash embed it.
//
// Namespaced per customer/initiative (linear_slug), matching portal.tests.project_slug.
// Vector ids are the source row's own id (Linear issue id / Supabase tests.id) so a
// re-upsert on edit overwrites in place instead of creating a duplicate. Issue ids and
// test ids come from unrelated UUID generators (Linear vs Postgres), so a collision
// between the two — which would silently overwrite one with the other now that they
// share an index — is astronomically unlikely, same risk any UUID space already
// accepts elsewhere in this app.
//
// Every export here is best-effort: a vector-sync hiccup must never fail the actual
// test/issue write it's attached to, so failures are caught and logged, not thrown —
// same convention as utils/issueUpdates.ts.

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
  // Every existing call is a POST — deleteIssueVectors below is the first
  // caller to need DELETE (Upstash's own delete-vectors endpoint), so this
  // stays optional and every other call site is unaffected.
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

// The namespace is usually a customer's `clientName`, which is stored
// inconsistently cased across the app depending on which flow created it
// (raw vs. slugified at onboarding — same drift already noted in
// components/chat/CometChat/useCometChat.ts). Upstash namespaces are exact
// strings with no case-insensitive matching, so without this every caller
// has to coincidentally agree on casing or an upsert and a later query land
// in two different, disconnected namespaces for the same customer.
// Normalizing here, at the one place every namespace passes through, means
// callers never have to think about it.
function normalizeNamespace(namespace: string): string {
  return namespace.trim().toLowerCase();
}

// Derives the bug/feature distinction from an issue's Linear labels — an exact
// (not substring) match on the label name, same as the frontend's LABEL_ICONS
// lookup in issue-cards.tsx, so a vector's `kind` metadata always agrees with
// whichever icon the label itself would render once the full issue loads.
export function deriveIssueKind(
  labels?: { name?: string | null }[] | null,
): "bug" | "feature" | null {
  const names = new Set((labels ?? []).map((l) => l.name?.toLowerCase()));
  if (names.has("bug")) return "bug";
  if (names.has("feature")) return "feature";
  return null;
}

// Removes one or more issue vectors by id from a namespace — used by
// linear-vector-sync to clean up after a ticket is deleted ("trashed") in
// Linear, since nothing else would ever tell Upstash to stop returning it as
// a "similar issue" match. Same best-effort convention as upsertIssueVector:
// a cleanup hiccup must never fail the sync run it's attached to.
export async function deleteIssueVectors(namespace: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const { url, token } = vectorIndex();
    // Each issue is stored as two vectors (see upsertIssueVector's own
    // ":title" comment) — both need removing, or the title-only one keeps
    // surfacing a trashed ticket on short similar-issues queries.
    const allIds = ids.flatMap((id) => [id, `${id}::title`]);
    await upstashRequest(
      url,
      token,
      `/delete/${normalizeNamespace(namespace)}`,
      { ids: allIds },
      "DELETE",
    );
  } catch (err) {
    console.error("[deleteIssueVectors] failed (non-fatal):", err);
  }
}

export async function upsertIssueVector(
  namespace: string,
  issue: {
    id: string;
    title: string;
    description?: string | null;
    // "bug" | "feature" | null — lets the similar-issues row show the right icon
    // immediately from the search response, instead of waiting on a follow-up
    // fetch of the full issue just to read its labels.
    kind?: "bug" | "feature" | null;
  },
): Promise<void> {
  try {
    const { url, token } = vectorIndex();
    const ns = normalizeNamespace(namespace);
    const combinedData = [issue.title, issue.description].filter(Boolean).join("\n\n");
    const baseMetadata = {
      ticket_id: issue.id,
      title: issue.title,
      ...(issue.kind ? { kind: issue.kind } : {}),
    };

    // Two vectors per issue: the existing title+description one (for queries
    // with real descriptive detail) and a title-only one, id-suffixed
    // "::title" to avoid colliding with the combined vector's own id — see
    // queryTopIssueMatches for why a second vector exists at all.
    await Promise.all([
      upstashRequest(url, token, `/upsert-data/${ns}`, {
        id: issue.id,
        data: combinedData,
        metadata: { type: "issue", ...baseMetadata },
      }),
      upstashRequest(url, token, `/upsert-data/${ns}`, {
        id: `${issue.id}::title`,
        data: issue.title,
        metadata: { type: "issue-title", ...baseMetadata },
      }),
    ]);
  } catch (err) {
    console.error("[upsertIssueVector] failed (non-fatal):", err);
  }
}

export async function upsertTestVector(
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
      // Spec only calls for `{ name }`, but a bare name with no id can't be resolved
      // back to the actual test row — test_id is added so query results are usable.
      metadata: { type: "test-case", test_id: test.id, name: test.title },
    });
  } catch (err) {
    console.error("[upsertTestVector] failed (non-fatal):", err);
  }
}

// Below this length, a query reads as a short/generic term (e.g. "roadmap")
// rather than an actual description — its embedding sits much closer to
// another short title than to a long title+description document's averaged-
// out embedding, so matching it against the combined vector was starving
// short queries of real hits (a ticket whose *description* talks about
// "roadmap" at length wouldn't clear the similarity threshold). At or above
// this length the query is assumed to carry real descriptive detail, so it's
// matched against the fuller combined vector instead, same as before.
const TITLE_ONLY_QUERY_MAX_LENGTH = 15;

export async function queryTopIssueMatches(
  namespace: string,
  queryText: string,
  topK = 3,
  // Scopes the similar-issues hint to just bugs (on the Report a Bug panel) or just
  // features (on Request a Feature), so a feature request never surfaces a bug as its
  // "similar ticket" or vice versa. Omit to search across both.
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
    // Normalize back to the underlying issue id regardless of which vector
    // variant matched — the title-only vector's own id carries the "::title"
    // suffix from upsertIssueVector, which callers (e.g. GET /issues/by-id)
    // wouldn't know how to resolve.
    return Array.isArray(result)
      ? result.map((m: VectorMatch) => ({ ...m, id: (m.metadata?.ticket_id as string) ?? m.id }))
      : [];
  } catch (err) {
    console.error("[queryTopIssueMatches] failed:", err);
    return [];
  }
}

export async function queryTopTestMatches(
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
