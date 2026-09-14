// @ts-nocheck
// Backs the developer dashboard's "Log Hours" modal — one row per submission in
// portal.hours_logged (see the companion migration for the table shape).
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

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    let res: Response;

    if (req.method === "POST") {
      res = await handleLogHours(req);
    } else if (req.method === "GET") {
      res = await handleGetHours(req);
    } else if (req.method === "PATCH") {
      res = await handleUpdateHours(req);
    } else if (req.method === "DELETE") {
      res = await handleDeleteHours(req);
    } else {
      res = Response.json({ error: "Not found" }, { status: 404 });
    }

    return new Response(res.body, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Hours API Error]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// POST /hours — log worked hours against a project, optionally tied to specific tickets.
async function handleLogHours(req: Request): Promise<Response> {
  const schema = "portal";
  const {
    developer_id,
    developer_email,
    project_slug,
    project_name,
    hours,
    worked_on,
    issue_ids,
    summary,
  } = await req.json();

  if (!developer_id || !developer_email || !project_slug || !project_name) {
    return Response.json(
      { error: "Missing developer_id, developer_email, project_slug, or project_name" },
      { status: 400 },
    );
  }
  if (!Number.isInteger(hours) || hours <= 0) {
    return Response.json({ error: "hours must be a positive integer" }, { status: 400 });
  }

  const res = await fetch(db("hours_logged"), {
    method: "POST",
    headers: headers(schema, { Prefer: "return=representation" }),
    body: JSON.stringify({
      developer_id,
      developer_email,
      project_slug,
      project_name,
      hours,
      worked_on: worked_on || todayISODate(),
      issue_ids: Array.isArray(issue_ids) ? issue_ids : [],
      summary: typeof summary === "string" && summary.trim() ? summary.trim() : null,
    }),
  });

  const data = await res.json();
  if (!res.ok) return Response.json({ error: "Failed to log hours", details: data }, { status: 500 });
  return Response.json(data[0] ?? data);
}

// GET /hours?developer_id=xxx — this developer's own logged hours, most recent
// work day first, so the dashboard can list (and offer to edit/delete) them.
async function handleGetHours(req: Request): Promise<Response> {
  const schema = "portal";
  const developer_id = new URL(req.url).searchParams.get("developer_id");
  if (!developer_id) return Response.json({ error: "Missing developer_id" }, { status: 400 });

  const res = await fetch(
    `${db("hours_logged")}?developer_id=eq.${developer_id}&order=worked_on.desc,created_at.desc`,
    { headers: headers(schema) },
  );
  const data = await res.json();
  if (!res.ok) return Response.json({ error: "Failed to fetch hours", details: data }, { status: 500 });
  return Response.json(data);
}

// Every row is scoped to whichever developer_id created it — both edit and delete
// re-check the row's own developer_id against the caller-supplied one before
// touching anything, since there's no server-side session here to derive it from.
async function assertOwnsEntry(schema: string, id: string, developer_id: string) {
  const res = await fetch(
    `${db("hours_logged")}?id=eq.${id}&select=developer_id`,
    { headers: headers(schema) },
  );
  const [existing] = await res.json();
  if (!existing) return { ok: false, response: Response.json({ error: "Entry not found" }, { status: 404 }) };
  if (existing.developer_id !== developer_id) {
    return { ok: false, response: Response.json({ error: "Not allowed to modify this entry" }, { status: 403 }) };
  }
  return { ok: true };
}

// PATCH /hours — edit one of the caller's own entries (hours, work date, project,
// tickets, and/or summary — only the fields present in the body are changed).
async function handleUpdateHours(req: Request): Promise<Response> {
  const schema = "portal";
  const {
    id,
    developer_id,
    hours,
    worked_on,
    project_slug,
    project_name,
    issue_ids,
    summary,
  } = await req.json();

  if (!id || !developer_id) {
    return Response.json({ error: "Missing id or developer_id" }, { status: 400 });
  }
  if (hours !== undefined && (!Number.isInteger(hours) || hours <= 0)) {
    return Response.json({ error: "hours must be a positive integer" }, { status: 400 });
  }

  const ownership = await assertOwnsEntry(schema, id, developer_id);
  if (!ownership.ok) return ownership.response;

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (hours !== undefined) updatePayload.hours = hours;
  if (worked_on !== undefined) updatePayload.worked_on = worked_on;
  if (project_slug !== undefined) updatePayload.project_slug = project_slug;
  if (project_name !== undefined) updatePayload.project_name = project_name;
  if (issue_ids !== undefined) updatePayload.issue_ids = Array.isArray(issue_ids) ? issue_ids : [];
  if (summary !== undefined) {
    updatePayload.summary = typeof summary === "string" && summary.trim() ? summary.trim() : null;
  }

  const res = await fetch(`${db("hours_logged")}?id=eq.${id}`, {
    method: "PATCH",
    headers: headers(schema, { Prefer: "return=representation" }),
    body: JSON.stringify(updatePayload),
  });

  const data = await res.json();
  if (!res.ok) return Response.json({ error: "Failed to update hours", details: data }, { status: 500 });
  return Response.json(data[0] ?? data);
}

// DELETE /hours?id=xxx&developer_id=yyy — remove one of the caller's own entries.
async function handleDeleteHours(req: Request): Promise<Response> {
  const schema = "portal";
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const developer_id = url.searchParams.get("developer_id");
  if (!id || !developer_id) {
    return Response.json({ error: "Missing id or developer_id" }, { status: 400 });
  }

  const ownership = await assertOwnsEntry(schema, id, developer_id);
  if (!ownership.ok) return ownership.response;

  const res = await fetch(`${db("hours_logged")}?id=eq.${id}`, {
    method: "DELETE",
    headers: headers(schema),
  });

  if (!res.ok) return Response.json({ error: "Failed to delete hours entry" }, { status: 500 });
  return Response.json({ success: true });
}
