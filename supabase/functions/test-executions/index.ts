// @ts-nocheck
// One row per attachment of a reusable Test (see supabase/functions/tests/index.ts) to
// a specific Linear ticket: the expected behaviour for that ticket, its status, and the
// accumulated QA/UAT results recorded against it.
import { corsHeaders } from "../utils/headers.ts";
import { markIssueUpdated } from "../utils/issueUpdates.ts";

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
      res = await handleGetExecutions(req);
    } else if (req.method === "POST") {
      res = await handleCreateExecution(req);
    } else if (req.method === "PATCH" && pathname.endsWith("/approve")) {
      res = await handleApproveExecution(req);
    } else if (req.method === "PATCH" && pathname.endsWith("/update")) {
      res = await handleUpdateExecution(req);
    } else if (req.method === "PATCH" && pathname.endsWith("/result")) {
      res = await handleRecordResult(req);
    } else if (req.method === "DELETE") {
      res = await handleDeleteExecution(req);
    } else {
      res = Response.json({ error: "Not found" }, { status: 404 });
    }

    return new Response(res.body, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Test Executions API Error]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// GET /test-executions?issue_id=xxx — every test attached to this ticket, with each
// execution's test (title/steps) merged in. Two plain fetches + JS merge, matching this
// codebase's existing style rather than a PostgREST embedded-resource select.
//
// GET /test-executions?test_id=xxx — the most recent execution of that test on *any*
// ticket, so the frontend can prefill "expected" when the same test gets picked again.
async function handleGetExecutions(req: Request): Promise<Response> {
  const schema = "portal";
  const url = new URL(req.url);
  const issue_id = url.searchParams.get("issue_id");
  const test_id = url.searchParams.get("test_id");

  if (test_id) {
    const res = await fetch(
      `${db("test_executions")}?test_id=eq.${test_id}&select=expected&order=created_at.desc&limit=1`,
      { headers: headers(schema) },
    );
    const rows = await res.json();
    if (!res.ok) {
      return Response.json({ error: "Failed to fetch latest execution", details: rows }, { status: 500 });
    }
    return Response.json(Array.isArray(rows) && rows[0] ? rows[0] : null);
  }

  if (!issue_id) return Response.json({ error: "Missing issue_id or test_id" }, { status: 400 });

  const execRes = await fetch(
    `${db("test_executions")}?issue_id=eq.${issue_id}&order=created_at.asc`,
    { headers: headers(schema) },
  );
  const executions = await execRes.json();
  if (!execRes.ok) {
    return Response.json({ error: "Failed to fetch test executions", details: executions }, { status: 500 });
  }
  if (!Array.isArray(executions) || executions.length === 0) return Response.json([]);

  const testIds = [...new Set(executions.map((e: any) => e.test_id))];
  const testsRes = await fetch(
    `${db("tests")}?id=in.(${testIds.join(",")})&select=id,title,steps,last_passed_execution_id`,
    { headers: headers(schema) },
  );
  const tests = await testsRes.json();
  const testById = new Map((Array.isArray(tests) ? tests : []).map((t: any) => [t.id, t]));

  const merged = executions.map((execution: any) => ({
    ...execution,
    test: testById.get(execution.test_id) ?? null,
  }));

  return Response.json(merged);
}

// POST /test-executions — attach a test to a ticket. Used both when the user just
// created a brand-new test (frontend POSTs /tests first, then this with the new
// test_id) and when they picked an existing one from the autocomplete.
async function handleCreateExecution(req: Request): Promise<Response> {
  const schema = "portal";
  const { test_id, issue_id, expected, created_by } = await req.json();

  if (!test_id || !issue_id || !created_by) {
    return Response.json({ error: "Missing test_id, issue_id, or created_by" }, { status: 400 });
  }

  const res = await fetch(db("test_executions"), {
    method: "POST",
    headers: headers(schema, { Prefer: "return=representation" }),
    body: JSON.stringify({
      test_id,
      issue_id,
      expected: expected ?? "",
      status: "draft",
      created_by,
    }),
  });

  const data = await res.json();
  if (!res.ok) return Response.json({ error: "Failed to attach test", details: data }, { status: 500 });

  await markIssueUpdated(issue_id, created_by);

  return Response.json(data[0] ?? data);
}

// PATCH /test-executions/approve — stakeholder/customer approves a draft execution.
async function handleApproveExecution(req: Request): Promise<Response> {
  const schema = "portal";
  const { execution_id, approved_by } = await req.json();
  if (!execution_id || !approved_by) {
    return Response.json({ error: "Missing execution_id or approved_by" }, { status: 400 });
  }

  const res = await fetch(`${db("test_executions")}?id=eq.${execution_id}`, {
    method: "PATCH",
    headers: headers(schema, { Prefer: "return=representation" }),
    body: JSON.stringify({ status: "approved", approved_by }),
  });

  const data = await res.json();
  if (!res.ok) return Response.json({ error: "Failed to approve execution", details: data }, { status: 500 });
  return Response.json(data[0] ?? data);
}

// PATCH /test-executions/update — edit the expected behaviour for this ticket, while
// the execution is still in draft.
async function handleUpdateExecution(req: Request): Promise<Response> {
  const schema = "portal";
  const { execution_id, expected } = await req.json();
  if (!execution_id) {
    return Response.json({ error: "Missing execution_id" }, { status: 400 });
  }

  const getRes = await fetch(`${db("test_executions")}?id=eq.${execution_id}&select=status`, {
    headers: headers(schema),
  });
  const [row] = await getRes.json();
  if (!row) return Response.json({ error: "Execution not found" }, { status: 404 });
  if (row.status !== "draft") {
    return Response.json({ error: "Only draft executions can be edited" }, { status: 400 });
  }

  const res = await fetch(`${db("test_executions")}?id=eq.${execution_id}`, {
    method: "PATCH",
    headers: headers(schema, { Prefer: "return=representation" }),
    body: JSON.stringify({
      expected: expected ?? "",
      updated_at: new Date().toISOString(),
    }),
  });

  const data = await res.json();
  if (!res.ok) return Response.json({ error: "Failed to update execution", details: data }, { status: 500 });
  return Response.json(data[0] ?? data);
}

// PATCH /test-executions/result — record a QA or UAT result and/or toggle passed
// status (renamed from the old /tests/uat endpoint since it already served both
// stages). When status becomes "passed", also points the parent test's
// last_passed_execution_id at this execution.
async function handleRecordResult(req: Request): Promise<Response> {
  const schema = "portal";
  const { execution_id, result, passed, recorded_by, kind, attachments } = await req.json();
  if (!execution_id || (result === undefined && passed === undefined)) {
    return Response.json(
      { error: "Missing execution_id, and at least one of result or passed" },
      { status: 400 },
    );
  }

  const updatePayload: Record<string, unknown> = {};

  if (result !== undefined) {
    const getRes = await fetch(`${db("test_executions")}?id=eq.${execution_id}&select=results`, {
      headers: headers(schema),
    });
    const [row] = await getRes.json();
    const current: unknown[] = Array.isArray(row?.results) ? row.results : [];

    updatePayload.results = [
      ...current,
      {
        text: result,
        recorded_by: recorded_by ?? null,
        recorded_at: new Date().toISOString(),
        kind: kind ?? null,
        attachments: Array.isArray(attachments) ? attachments : [],
      },
    ];
  }

  if (passed !== undefined) {
    updatePayload.status = passed ? "passed" : "approved";
  }

  const res = await fetch(`${db("test_executions")}?id=eq.${execution_id}`, {
    method: "PATCH",
    headers: headers(schema, { Prefer: "return=representation" }),
    body: JSON.stringify(updatePayload),
  });

  const data = await res.json();
  if (!res.ok) return Response.json({ error: "Failed to record result", details: data }, { status: 500 });

  const updated = data[0] ?? data;

  if (passed === true && updated?.test_id) {
    await fetch(`${db("tests")}?id=eq.${updated.test_id}`, {
      method: "PATCH",
      headers: headers(schema),
      body: JSON.stringify({ last_passed_execution_id: execution_id }),
    });
  }

  return Response.json(updated);
}

// DELETE /test-executions?execution_id=xxx — detach a test from a ticket.
async function handleDeleteExecution(req: Request): Promise<Response> {
  const schema = "portal";
  const execution_id = new URL(req.url).searchParams.get("execution_id");
  if (!execution_id) return Response.json({ error: "Missing execution_id" }, { status: 400 });

  const res = await fetch(`${db("test_executions")}?id=eq.${execution_id}`, {
    method: "DELETE",
    headers: headers(schema),
  });

  if (!res.ok) return Response.json({ error: "Failed to delete execution" }, { status: 500 });
  return Response.json({ success: true });
}
