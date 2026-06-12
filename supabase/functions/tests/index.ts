// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";

const supabaseUrl = () => Deno.env.get("PROJECT_URL")!;
const serviceKey = () => Deno.env.get("SERVICE_SECRET_KEY")!;

function db(path: string) {
  return `${supabaseUrl()}/rest/v1/${path}`;
}

function headers(extra: Record<string, string> = {}) {
  return {
    apikey: serviceKey(),
    Authorization: `Bearer ${serviceKey()}`,
    "Content-Type": "application/json",
    "Accept-Profile": "portal",
    "Content-Profile": "portal",
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
  const issue_id = new URL(req.url).searchParams.get("issue_id");
  if (!issue_id) return Response.json({ error: "Missing issue_id" }, { status: 400 });

  const res = await fetch(
    `${db("tests")}?issue_id=eq.${issue_id}&order=created_at.asc`,
    { headers: headers() },
  );
  const data = await res.json();
  return Response.json(data);
}

// POST /tests — admin creates a test case
async function handleCreateTest(req: Request): Promise<Response> {
  const { issue_id, title, steps, expected, created_by } = await req.json();

  if (!issue_id || !title || !created_by) {
    return Response.json({ error: "Missing issue_id, title, or created_by" }, { status: 400 });
  }

  const res = await fetch(db("tests"), {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
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
  const { test_id, approved_by } = await req.json();
  if (!test_id || !approved_by) {
    return Response.json({ error: "Missing test_id or approved_by" }, { status: 400 });
  }

  const res = await fetch(`${db("tests")}?id=eq.${test_id}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({ status: "approved", approved_by }),
  });

  const data = await res.json();
  if (!res.ok) return Response.json({ error: "Failed to approve test", details: data }, { status: 500 });
  return Response.json(data[0] ?? data);
}

// PATCH /tests/uat — stakeholder fills in actual result during UAT
async function handleUatTest(req: Request): Promise<Response> {
  const { test_id, actual, passed } = await req.json();
  if (!test_id || actual === undefined) {
    return Response.json({ error: "Missing test_id or actual" }, { status: 400 });
  }

  const res = await fetch(`${db("tests")}?id=eq.${test_id}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({ actual, status: passed ? "passed" : "failed" }),
  });

  const data = await res.json();
  if (!res.ok) return Response.json({ error: "Failed to update UAT result", details: data }, { status: 500 });
  return Response.json(data[0] ?? data);
}

// DELETE /tests?test_id=xxx — admin deletes a draft test
async function handleDeleteTest(req: Request): Promise<Response> {
  const test_id = new URL(req.url).searchParams.get("test_id");
  if (!test_id) return Response.json({ error: "Missing test_id" }, { status: 400 });

  const res = await fetch(`${db("tests")}?id=eq.${test_id}`, {
    method: "DELETE",
    headers: headers(),
  });

  if (!res.ok) return Response.json({ error: "Failed to delete test" }, { status: 500 });
  return Response.json({ success: true });
}
