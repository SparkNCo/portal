// @ts-nocheck
// Upstash Vector client for the two hosted-embedding indexes: issues and test cases.
// Both indexes are created manually in the Upstash console with a built-in embedding
// model (e.g. mxbai-embed-large-v1) — the app never computes embeddings itself, it
// just sends raw text via Upstash's "-data" endpoints and lets Upstash embed it.
//
// Namespaced per customer/initiative (linear_slug), matching portal.tests.project_slug.
// Vector ids are the source row's own id (Linear issue id / Supabase tests.id) so a
// re-upsert on edit overwrites in place instead of creating a duplicate.
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
): Promise<any> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
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

function issuesIndex() {
  return {
    url: Deno.env.get("UPSTASH_ISSUES_VECTOR_REST_URL")!,
    token: Deno.env.get("UPSTASH_ISSUES_VECTOR_REST_TOKEN")!,
  };
}

function testCasesIndex() {
  return {
    url: Deno.env.get("UPSTASH_TEST_CASES_VECTOR_REST_URL")!,
    token: Deno.env.get("UPSTASH_TEST_CASES_VECTOR_REST_TOKEN")!,
  };
}

export async function upsertIssueVector(
  namespace: string,
  issue: { id: string; title: string; description?: string | null },
): Promise<void> {
  try {
    const { url, token } = issuesIndex();
    const data = [issue.title, issue.description].filter(Boolean).join("\n\n");
    await upstashRequest(url, token, `/upsert-data/${namespace}`, {
      id: issue.id,
      data,
      metadata: { ticket_id: issue.id, title: issue.title },
    });
  } catch (err) {
    console.error("[upsertIssueVector] failed (non-fatal):", err);
  }
}

export async function upsertTestVector(
  namespace: string,
  test: { id: string; title: string; steps: { order: number; description: string }[] },
): Promise<void> {
  try {
    const { url, token } = testCasesIndex();
    const stepsText = (test.steps ?? []).map((s) => s.description).join("\n");
    const data = [test.title, stepsText].filter(Boolean).join("\n\n");
    await upstashRequest(url, token, `/upsert-data/${namespace}`, {
      id: test.id,
      data,
      // Spec only calls for `{ name }`, but a bare name with no id can't be resolved
      // back to the actual test row — test_id is added so query results are usable.
      metadata: { test_id: test.id, name: test.title },
    });
  } catch (err) {
    console.error("[upsertTestVector] failed (non-fatal):", err);
  }
}

export async function queryTopIssueMatches(
  namespace: string,
  queryText: string,
  topK = 3,
): Promise<VectorMatch[]> {
  try {
    const { url, token } = issuesIndex();
    const result = await upstashRequest(url, token, `/query-data/${namespace}`, {
      data: queryText,
      topK,
      includeMetadata: true,
    });
    return Array.isArray(result) ? result : [];
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
    const { url, token } = testCasesIndex();
    const result = await upstashRequest(url, token, `/query-data/${namespace}`, {
      data: queryText,
      topK,
      includeMetadata: true,
    });
    return Array.isArray(result) ? result : [];
  } catch (err) {
    console.error("[queryTopTestMatches] failed:", err);
    return [];
  }
}
