// @ts-nocheck
// Reusable Test definitions (name + steps). Executions of a test against a specific
// Linear ticket live in the separate `test-executions` function/table — see
// supabase/functions/test-executions/index.ts.
import { corsHeaders } from "../utils/headers.ts";
import { upsertTestVector, queryTopTestMatches } from "../lib/vector.ts";
import { resolveLinearSlug } from "../utils/slug.ts";

// Raised from the original 0.7 (see test-picker.tsx) to 0.8.
const SIMILARITY_THRESHOLD = 0.8;

const SCHEMA = "portal";

// Callers send the clientName route slug; tests.project_slug and the vector
// namespace must be customers.linear_slug. Resolve once here for every handler
// — the raw value wouldn't match any stored project_slug.
async function resolveTestProjectSlug(rawSlug: string): Promise<string | null> {
  return await resolveLinearSlug(SCHEMA, rawSlug);
}

const supabaseUrl = () => Deno.env.get("PROJECT_URL")!;
const serviceKey = () => Deno.env.get("SERVICE_SECRET_KEY")!;

function db(path: string) {
  return `${supabaseUrl()}/rest/v1/${path}`;
}

function headers(schema: string, extra: Record<string, string> = {}) {
  return {
    apikey: serviceKey(),
    Authorization: `Bearer ${serviceKey()}`,
    "Content-Type": "application/json",
    "Accept-Profile": schema,
    "Content-Profile": schema,
    ...extra,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const pathname = new URL(req.url).pathname;
    let res: Response;

    if (req.method === "POST" && pathname.endsWith("/backfill-vectors")) {
      res = await handleBackfillTestVectors(req);
    } else if (req.method === "GET" && pathname.endsWith("/similar")) {
      res = await handleSimilarTests(req);
    } else if (req.method === "GET") {
      res = await handleSearchTests(req);
    } else if (req.method === "POST") {
      res = await handleCreateTest(req);
    } else if (req.method === "PATCH" && pathname.endsWith("/update")) {
      res = await handleUpdateTest(req);
    } else if (req.method === "DELETE") {
      res = await handleDeleteTest(req);
    } else {
      res = Response.json({ error: "Not found" }, { status: 404 });
    }

    return new Response(res.body, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Tests API Error]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// GET /tests?project_slug=xxx&q=search — autocomplete, scoped to one customer.
// `q` optional (lists recent). `id` fetches one row (resolves /tests/similar matches).
async function handleSearchTests(req: Request): Promise<Response> {
  const schema = "portal";
  const url = new URL(req.url);
  const rawProjectSlug = url.searchParams.get("project_slug");
  const id = url.searchParams.get("id");
  const q = url.searchParams.get("q")?.trim();
  if (!rawProjectSlug) return Response.json({ error: "Missing project_slug" }, { status: 400 });

  const project_slug = await resolveTestProjectSlug(rawProjectSlug);
  if (!project_slug) return Response.json([]);

  const params = new URLSearchParams({
    project_slug: `eq.${project_slug}`,
    select: "id,title,steps,last_passed_execution_id",
    order: "title.asc",
    limit: "10",
  });
  if (id) params.set("id", `eq.${id}`);
  else if (q) params.set("title", `ilike.*${q}*`);

  const res = await fetch(`${db("tests")}?${params.toString()}`, { headers: headers(schema) });
  const data = await res.json();
  return Response.json(data);
}

// GET /tests/similar?project_slug=xxx&q=... — semantic search. The frontend
// enforces a minimum query length, not this endpoint.
async function handleSimilarTests(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const rawProjectSlug = url.searchParams.get("project_slug");
  const q = url.searchParams.get("q");

  if (!rawProjectSlug || !q?.trim()) return Response.json([]);

  const project_slug = await resolveTestProjectSlug(rawProjectSlug);
  if (!project_slug) return Response.json([]);

  const matches = await queryTopTestMatches(project_slug, q.trim(), 3);
  return Response.json(matches.filter((m) => m.score >= SIMILARITY_THRESHOLD));
}

// POST /tests — create a reusable test case (per-ticket data lives in test_executions).
async function handleCreateTest(req: Request): Promise<Response> {
  const schema = "portal";
  const { project_slug: rawProjectSlug, title, steps, created_by } = await req.json();

  if (!rawProjectSlug || !title || !created_by) {
    return Response.json({ error: "Missing project_slug, title, or created_by" }, { status: 400 });
  }

  const project_slug = await resolveTestProjectSlug(rawProjectSlug);
  if (!project_slug) {
    return Response.json({ error: `No customer found for slug "${rawProjectSlug}"` }, { status: 404 });
  }

  const res = await fetch(db("tests"), {
    method: "POST",
    headers: headers(schema, { Prefer: "return=representation" }),
    body: JSON.stringify({
      project_slug,
      title,
      steps: steps ?? [],
      created_by,
    }),
  });

  const data = await res.json();
  if (!res.ok) return Response.json({ error: "Failed to create test", details: data }, { status: 500 });

  const { embedding: _embedding, ...created } = data[0] ?? data;
  await upsertTestVector(project_slug, created);
  return Response.json(created);
}

// PATCH /tests/update — edit title/steps, only if it has never passed (so a
// certified test can't be rewritten).
async function handleUpdateTest(req: Request): Promise<Response> {
  const schema = "portal";
  const { test_id, title, steps } = await req.json();
  if (!test_id || !title) {
    return Response.json({ error: "Missing test_id or title" }, { status: 400 });
  }

  const getRes = await fetch(`${db("tests")}?id=eq.${test_id}&select=last_passed_execution_id`, {
    headers: headers(schema),
  });
  const [row] = await getRes.json();
  if (!row) return Response.json({ error: "Test not found" }, { status: 404 });
  if (row.last_passed_execution_id) {
    return Response.json(
      { error: "This test has already passed on a ticket and can no longer be edited" },
      { status: 400 },
    );
  }

  const res = await fetch(`${db("tests")}?id=eq.${test_id}`, {
    method: "PATCH",
    headers: headers(schema, { Prefer: "return=representation" }),
    body: JSON.stringify({
      title,
      steps: steps ?? [],
      updated_at: new Date().toISOString(),
    }),
  });

  const data = await res.json();
  if (!res.ok) return Response.json({ error: "Failed to update test", details: data }, { status: 500 });

  // The returned row includes the (now stale) embedding — not sent to the client.
  const { embedding: _embedding, ...updated } = data[0] ?? data;
  if (updated.project_slug) await upsertTestVector(updated.project_slug, updated);
  return Response.json(updated);
}

// Embedding is CPU-heavy (gte-small runs in-process), so a backfill call only
// handles this many tests; call again until `remaining` is 0.
const BACKFILL_BATCH_SIZE = 25;

// POST /tests/backfill-vectors { user_id, project_slug? } — admin-only. Embeds
// tests that don't have an embedding yet (e.g. created while their customer
// was on Upstash), oldest first, BACKFILL_BATCH_SIZE per call.
async function handleBackfillTestVectors(req: Request): Promise<Response> {
  const schema = "portal";
  const { user_id, project_slug: rawProjectSlug } = await req.json();
  if (!user_id) return Response.json({ error: "user_id is required" }, { status: 400 });

  const callerRes = await fetch(`${db("users")}?id=eq.${user_id}&select=role`, {
    headers: headers(schema),
  });
  const [caller] = callerRes.ok ? await callerRes.json() : [];
  if (caller?.role !== "admin") return Response.json({ error: "Admin only" }, { status: 403 });

  const params = new URLSearchParams({
    embedding: "is.null",
    select: "id,title,steps,project_slug",
    order: "created_at.asc",
    limit: String(BACKFILL_BATCH_SIZE),
  });
  if (rawProjectSlug) {
    const project_slug = await resolveTestProjectSlug(rawProjectSlug);
    if (!project_slug) {
      return Response.json({ error: `No customer found for slug "${rawProjectSlug}"` }, { status: 404 });
    }
    params.set("project_slug", `ilike.${project_slug}`);
  }

  const res = await fetch(`${db("tests")}?${params.toString()}`, {
    headers: headers(schema, { Prefer: "count=exact" }),
  });
  if (!res.ok) return Response.json({ error: "Failed to load tests", details: await res.text() }, { status: 500 });
  const tests = await res.json();
  // Content-Range: "0-24/137" — the total still missing before this batch.
  const total = Number(res.headers.get("content-range")?.split("/")[1] ?? tests.length);

  let vectorized = 0;
  let failed = 0;
  for (const test of tests) {
    const ok = await upsertTestVector(test.project_slug, test);
    if (ok) vectorized++;
    else failed++;
  }

  return Response.json({ success: true, vectorized, failed, remaining: Math.max(total - vectorized, 0) });
}

// DELETE /tests?test_id=xxx — refused if attached to any ticket (the FK cascade
// would wipe that ticket's test history).
async function handleDeleteTest(req: Request): Promise<Response> {
  const schema = "portal";
  const test_id = new URL(req.url).searchParams.get("test_id");
  if (!test_id) return Response.json({ error: "Missing test_id" }, { status: 400 });

  const executionsRes = await fetch(
    `${db("test_executions")}?test_id=eq.${test_id}&select=id&limit=1`,
    { headers: headers(schema) },
  );
  const existingExecutions = await executionsRes.json();
  if (Array.isArray(existingExecutions) && existingExecutions.length > 0) {
    return Response.json(
      { error: "Can't delete a test that's already attached to a ticket" },
      { status: 400 },
    );
  }

  const res = await fetch(`${db("tests")}?id=eq.${test_id}`, {
    method: "DELETE",
    headers: headers(schema),
  });

  if (!res.ok) return Response.json({ error: "Failed to delete test" }, { status: 500 });
  return Response.json({ success: true });
}
