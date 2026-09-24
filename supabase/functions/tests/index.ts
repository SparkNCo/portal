// @ts-nocheck
// Reusable Test definitions (name + steps). Executions of a test against a specific
// Linear ticket live in the separate `test-executions` function/table — see
// supabase/functions/test-executions/index.ts.
import { corsHeaders } from "../utils/headers.ts";
import { upsertTestVector, queryTopTestMatches } from "../lib/vector.ts";
import { resolveVectorProvider } from "../lib/vectorProvider.ts";
import { resolveLinearSlug } from "../utils/slug.ts";

// Raised from the original 0.7 (see test-picker.tsx) to 0.8 for both
// providers — unlike issues, this one wasn't split per-provider on request.
const SIMILARITY_THRESHOLD_BY_PROVIDER = { upstash: 0.8, pgvector: 0.8 } as const;

const SCHEMA = "portal";

// Every caller sends `project_slug` as the frontend's clientName-based route
// slug (issue-detail-modal.tsx passes its own `slug` prop straight through,
// unresolved) — but portal.tests.project_slug needs to be the real
// customers.linear_slug, the same value documents/issues/the vector index
// are namespaced by (see resolveVectorProvider). Resolving here, once, for
// every handler keeps that column (and the vector namespace, and the
// "pick/search an existing test" autocomplete that filters by it) all
// consistent with each other — this used to just trust the raw value,
// which silently kept every test customer's vectors in a namespace that
// never matched customers.linear_slug, so resolveVectorProvider could never
// find that customer's systems.vector and always fell back to Upstash.
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

    if (req.method === "GET" && pathname.endsWith("/similar")) {
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

// GET /tests?project_slug=xxx&q=search — autocomplete for "pick an existing test",
// scoped to the current customer/initiative so one customer's test names never leak
// into another's suggestions. `q` is optional (empty search just lists recent tests).
// `id` looks up one specific test directly — used to resolve a semantic match from
// /tests/similar (which only carries {test_id, name} metadata) into the full row.
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

// GET /tests/similar?project_slug=xxx&q=... — semantic "similar tests" suggestion,
// backed by the Upstash test-cases vector index. Only meaningful once the user has
// typed enough real text to embed; the frontend enforces that minimum, not this
// endpoint (mirrors GET /issues/similar).
async function handleSimilarTests(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const rawProjectSlug = url.searchParams.get("project_slug");
  const q = url.searchParams.get("q");

  if (!rawProjectSlug || !q?.trim()) return Response.json([]);

  const project_slug = await resolveTestProjectSlug(rawProjectSlug);
  if (!project_slug) return Response.json([]);

  const [matches, provider] = await Promise.all([
    queryTopTestMatches(project_slug, q.trim(), 3),
    resolveVectorProvider(project_slug),
  ]);
  const threshold = SIMILARITY_THRESHOLD_BY_PROVIDER[provider];
  return Response.json(matches.filter((m) => m.score >= threshold));
}

// POST /tests — create a new reusable test case (no issue_id/expected/status anymore —
// those live on the test_executions row created separately once this test is attached
// to a ticket).
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

  const created = data[0] ?? data;
  await upsertTestVector(project_slug, created);
  return Response.json(created);
}

// PATCH /tests/update — edit a test's title/steps. Only while it has never had a
// passed execution, so the "recipe" can't be rewritten out from under a ticket that
// already certified it worked.
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

  const updated = data[0] ?? data;
  if (updated.project_slug) await upsertTestVector(updated.project_slug, updated);
  return Response.json(updated);
}

// DELETE /tests?test_id=xxx — refuses to delete a test that's attached to any ticket
// (test_executions.test_id cascades on delete, so allowing this unconditionally would
// silently wipe another ticket's test history).
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
