// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";

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

    if (req.method === "GET") {
      res = await handleGetTests(req);
    } else if (req.method === "POST") {
      res = await handleCreateTest(req);
    } else if (req.method === "PATCH" && pathname.endsWith("/approve")) {
      res = await handleApproveTest(req);
    } else if (req.method === "PATCH" && pathname.endsWith("/update")) {
      res = await handleUpdateTest(req);
    } else if (req.method === "PATCH" && pathname.endsWith("/uat")) {
      res = await handleUatTest(req);
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

// GET /tests?issue_id=xxx
async function handleGetTests(req: Request): Promise<Response> {
  const schema = "portal";
  const issue_id = new URL(req.url).searchParams.get("issue_id");
  if (!issue_id) return Response.json({ error: "Missing issue_id" }, { status: 400 });

  const res = await fetch(
    `${db("tests")}?issue_id=eq.${issue_id}&order=created_at.asc`,
    { headers: headers(schema) },
  );
  const data = await res.json();
  return Response.json(data);
}

// POST /tests — admin creates a test case
async function handleCreateTest(req: Request): Promise<Response> {
  const schema = "portal";
  const { issue_id, title, steps, expected, created_by } = await req.json();

  if (!issue_id || !title || !created_by) {
    return Response.json({ error: "Missing issue_id, title, or created_by" }, { status: 400 });
  }

  const res = await fetch(db("tests"), {
    method: "POST",
    headers: headers(schema, { Prefer: "return=representation" }),
    body: JSON.stringify({
      issue_id,
      title,
      steps: steps ?? [],
      expected: expected ?? "",
      status: "draft",
      created_by,
    }),
  });

  const data = await res.json();
  if (!res.ok) return Response.json({ error: "Failed to create test", details: data }, { status: 500 });
  return Response.json(data[0] ?? data);
}

// PATCH /tests/approve — stakeholder approves a test case
async function handleApproveTest(req: Request): Promise<Response> {
  const schema = "portal";
  const { test_id, approved_by } = await req.json();
  if (!test_id || !approved_by) {
    return Response.json({ error: "Missing test_id or approved_by" }, { status: 400 });
  }

  const res = await fetch(`${db("tests")}?id=eq.${test_id}`, {
    method: "PATCH",
    headers: headers(schema, { Prefer: "return=representation" }),
    body: JSON.stringify({ status: "approved", approved_by }),
  });

  const data = await res.json();
  if (!res.ok) return Response.json({ error: "Failed to approve test", details: data }, { status: 500 });
  return Response.json(data[0] ?? data);
}

// PATCH /tests/update — admin edits a test case while it's still in draft
async function handleUpdateTest(req: Request): Promise<Response> {
  const schema = "portal";
  const { test_id, title, steps, expected } = await req.json();
  if (!test_id || !title) {
    return Response.json({ error: "Missing test_id or title" }, { status: 400 });
  }

  const getRes = await fetch(`${db("tests")}?id=eq.${test_id}&select=status`, {
    headers: headers(schema),
  });
  const [row] = await getRes.json();
  if (!row) return Response.json({ error: "Test not found" }, { status: 404 });
  if (row.status !== "draft") {
    return Response.json({ error: "Only draft tests can be edited" }, { status: 400 });
  }

  const res = await fetch(`${db("tests")}?id=eq.${test_id}`, {
    method: "PATCH",
    headers: headers(schema, { Prefer: "return=representation" }),
    body: JSON.stringify({
      title,
      steps: steps ?? [],
      expected: expected ?? "",
      updated_at: new Date().toISOString(),
    }),
  });

  const data = await res.json();
  if (!res.ok) return Response.json({ error: "Failed to update test", details: data }, { status: 500 });
  return Response.json(data[0] ?? data);
}

// PATCH /tests/uat — record the actual UAT result and/or toggle passed status
async function handleUatTest(req: Request): Promise<Response> {
  const schema = "portal";
  const { test_id, actual, passed, recorded_by, kind } = await req.json();
  if (!test_id || (actual === undefined && passed === undefined)) {
    return Response.json({ error: "Missing test_id, and at least one of actual or passed" }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {};

  if (actual !== undefined) {
    const getRes = await fetch(`${db("tests")}?id=eq.${test_id}&select=actual`, {
      headers: headers(schema),
    });
    const [row] = await getRes.json();
    const current: unknown[] = Array.isArray(row?.actual) ? row.actual : [];

    updatePayload.actual = [
      ...current,
      {
        text: actual,
        recorded_by: recorded_by ?? null,
        recorded_at: new Date().toISOString(),
        kind: kind ?? null,
      },
    ];
  }

  if (passed !== undefined) {
    updatePayload.status = passed ? "passed" : "approved";
  }

  const res = await fetch(`${db("tests")}?id=eq.${test_id}`, {
    method: "PATCH",
    headers: headers(schema, { Prefer: "return=representation" }),
    body: JSON.stringify(updatePayload),
  });

  const data = await res.json();
  if (!res.ok) return Response.json({ error: "Failed to update UAT result", details: data }, { status: 500 });
  return Response.json(data[0] ?? data);
}

// DELETE /tests?test_id=xxx — admin deletes a draft test
async function handleDeleteTest(req: Request): Promise<Response> {
  const schema = "portal";
  const test_id = new URL(req.url).searchParams.get("test_id");
  if (!test_id) return Response.json({ error: "Missing test_id" }, { status: 400 });

  const res = await fetch(`${db("tests")}?id=eq.${test_id}`, {
    method: "DELETE",
    headers: headers(schema),
  });

  if (!res.ok) return Response.json({ error: "Failed to delete test" }, { status: 500 });
  return Response.json({ success: true });
}
