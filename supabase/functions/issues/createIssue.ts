// @ts-nocheck
// Creating tickets and projects, and attaching files to tickets — through
// the ticket-system wrapper (lib/tickets/provider.ts).
import { upsertIssueVector } from "../lib/vector.ts";
import { ticketErrorResponse } from "../lib/tickets/errors.ts";
import { ticketsForId, ticketsForSlug } from "../lib/tickets/provider.ts";
import { linearTickets } from "../lib/tickets/linear/issues.ts";
import { recordIssueRequest } from "./issueRequests.ts";

// Moved to lib/tickets/linear/client.ts; re-exported for
// suggested-features/acceptSuggestion.ts.
export { PRIORITY_MAP, CREATE_ISSUE_MUTATION } from "../lib/tickets/linear/client.ts";

// POST /issues/upload — uploads a file and returns its URL, to attach to a
// ticket afterwards (POST /issues/attachment). An optional `slug` form field
// picks the customer's ticket system; without it, Linear (as before).
export async function handleRequestUpload(req: Request): Promise<Response> {
  const formData = await req.formData();
  const file = formData.get("file");
  const slug = formData.get("slug");

  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file" }, { status: 400 });
  }

  try {
    const tickets = typeof slug === "string" && slug ? (await ticketsForSlug(slug)).tickets : linearTickets(null);
    return Response.json(await tickets.uploadFile(file));
  } catch (err) {
    return ticketErrorResponse(err);
  }
}

// GET /issues/attachments?issueId= — the files (and links) attached to an
// issue, newest first. Fetched on demand by the ticket's Description tab
// rather than with every issue list.
export async function handleGetAttachments(req: Request): Promise<Response> {
  const issueId = new URL(req.url).searchParams.get("issueId");
  if (!issueId) return Response.json({ error: "Missing issueId" }, { status: 400 });

  try {
    const tickets = await ticketsForId(issueId);
    return Response.json(await tickets.listAttachments(issueId));
  } catch (err) {
    return ticketErrorResponse(err);
  }
}

// POST /issues/attachment — attaches an already-uploaded file (by its URL) to an issue
export async function handleCreateAttachment(req: Request): Promise<Response> {
  const { issueId, url, title } = await req.json();

  if (!issueId || !url) {
    return Response.json({ error: "Missing issueId or url" }, { status: 400 });
  }

  try {
    const tickets = await ticketsForId(issueId);
    return Response.json(await tickets.createAttachment(issueId, url, title));
  } catch (err) {
    return ticketErrorResponse(err);
  }
}

export async function handleCreateProject(req: Request): Promise<Response> {
  const { name, description, targetDate, slug } = await req.json();

  if (!name?.trim()) {
    return Response.json({ error: "Missing project name" }, { status: 400 });
  }
  if (!slug) {
    return Response.json({ error: "Missing slug" }, { status: 400 });
  }

  try {
    const { tickets } = await ticketsForSlug(slug);
    return Response.json(await tickets.createProject({ name, description, targetDate }));
  } catch (err) {
    return ticketErrorResponse(err);
  }
}

export async function handleCreateIssue(req: Request): Promise<Response> {
  const body = await req.json();
  const { title, slug, type, teamId, requestedBy } = body;

  if (!title?.trim()) {
    return Response.json({ error: "Missing title" }, { status: 400 });
  }
  if (!slug && !teamId) {
    return Response.json({ error: "Missing teamId or slug" }, { status: 400 });
  }

  let created;
  // Vector namespace must be linear_slug (stable, same as linear-vector-sync),
  // not the route `slug` (editable, inconsistently cased).
  let linearSlug: string | null = null;
  try {
    // With a slug, the customer's ticket system; with only a teamId, Linear.
    const resolved = slug ? await ticketsForSlug(slug) : { customer: null, tickets: linearTickets(null) };
    linearSlug = resolved.customer?.linear_slug ?? null;
    created = await resolved.tickets.createIssue(body);
  } catch (err) {
    return ticketErrorResponse(err);
  }
  const createdIssue = created?.issue;

  // Who asked for it in the portal (shown in the ticket header).
  await recordIssueRequest(createdIssue?.id, requestedBy);

  // Best-effort: makes the new ticket searchable right away.
  if (linearSlug && createdIssue) {
    await upsertIssueVector(linearSlug, {
      id: createdIssue.id,
      title: title.trim(),
      description: body.description ?? "",
      kind: type === "bug" || type === "feature" ? type : null,
    });
  }

  return Response.json(created);
}
