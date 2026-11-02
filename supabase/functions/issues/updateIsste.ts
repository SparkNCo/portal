// @ts-nocheck
// Changing tickets (status, fields, cycle), decisions on a ticket, and the
// project / milestone / label pickers. Ticket-system calls go through the
// wrapper (lib/tickets/provider.ts), so they work for Linear and Jira alike.
import { supabase } from "../client.ts";
import { markIssueUpdated, markIssueViewed } from "../utils/issueUpdates.ts";
import { notifyProject, resolveIssueDashboardLink } from "../utils/notify.ts";
import { resolveLinearSlug } from "../utils/slug.ts";
import { upsertIssueVector, queryTopIssueMatches, deriveIssueKind } from "../lib/vector.ts";
import { resolveVectorProvider } from "../lib/vectorProvider.ts";
import { TicketError, ticketErrorResponse } from "../lib/tickets/errors.ts";
import { customerBySlug, ticketsForCustomer, ticketsForId } from "../lib/tickets/provider.ts";
import { linearTickets } from "../lib/tickets/linear/issues.ts";

// Moved to lib/tickets/linear/client.ts; re-exported for suggested-features
// (acceptSuggestion, updateSuggestionMilestone, updateSuggestionProject).
export { GET_STATE_ID_QUERY, GET_PROJECTS_BY_IDS_QUERY, GET_MILESTONES_QUERY } from "../lib/tickets/linear/client.ts";

export async function handleUpdateState(req: Request): Promise<Response> {
  try {
    const body = await req.json();

    // actorEmail/slug/issueCode/issueType are for the status-change
    // notification; without a slug nobody is notified.
    const { issueId, stateName, actorEmail, slug, issueCode, issueType } = body;

    if (!issueId || !stateName) {
      return Response.json({ error: "Missing issueId or stateName" }, { status: 400 });
    }

    const tickets = await ticketsForId(issueId);
    const { result, previousState } = await tickets.setIssueState(issueId, stateName);

    if (result?.success && actorEmail) {
      await markIssueUpdated(issueId, actorEmail);
    }
    if (result?.success && slug && actorEmail && previousState !== stateName) {
      // Fire-and-forget so notifications don't delay the response.
      EdgeRuntime.waitUntil(notifyProject({
        slug,
        actorEmail,
        action: "status_changed",
        objectType: "issue_status",
        objectId: issueId,
        link: resolveIssueDashboardLink(slug, issueType),
        // Read by the bell as "changed the status <preview>".
        preview: previousState ? `from ${previousState} to ${stateName}` : `to ${stateName}`,
        issueCode,
        issueId,
      }));
    }

    return Response.json(result);
  } catch (err) {
    if (err instanceof TicketError) return ticketErrorResponse(err);
    console.error("💥 handleUpdateState error:", err);
    return Response.json({ error: "Internal server error", details: String(err) }, { status: 500 });
  }
}

export async function handleGetIssueCycles(req: Request): Promise<Response> {
  const issueId = new URL(req.url).searchParams.get("issueId");
  if (!issueId) return Response.json({ error: "Missing issueId" }, { status: 400 });

  try {
    const tickets = await ticketsForId(issueId);
    return Response.json(await tickets.issueCycles(issueId));
  } catch (err) {
    return ticketErrorResponse(err);
  }
}

export async function handleUpdateIssue(req: Request): Promise<Response> {
  const body = await req.json();
  const { issueId, title, description, priority, actorEmail, slug } = body;

  if (!issueId) {
    return Response.json({ error: "Missing issueId" }, { status: 400 });
  }

  let result;
  try {
    const tickets = await ticketsForId(issueId);
    result = await tickets.updateIssue(issueId, {
      title,
      description,
      priority,
      // null takes the ticket out of its cycle; absent leaves it.
      ...("cycleId" in body && { cycleId: body.cycleId ?? null }),
    });
  } catch (err) {
    return ticketErrorResponse(err);
  }
  const updatedIssue = result?.issue;

  if (actorEmail) {
    await markIssueUpdated(issueId, actorEmail);
  }

  // Best-effort — keeps the issues vector index in sync for edits made through this
  // app. Edits made directly in Linear are caught by the linear-vector-sync cron.
  if (slug && updatedIssue) {
    const linearSlug = await resolveLinearSlug("portal", slug);
    if (linearSlug) {
      await upsertIssueVector(linearSlug, {
        id: updatedIssue.id,
        title: updatedIssue.title,
        description: updatedIssue.description,
        kind: deriveIssueKind(updatedIssue.labels?.nodes),
      });
    }
  }

  return Response.json(result);
}

// "Similar issue" hint on the Feature Request / Bug Report panels. Thresholds
// are per provider: Upstash (mxbai-embed-large-v1) was calibrated at 0.7;
// pgvector's gte-small scores unrelated short text ~0.8, so it needs a higher
// cutoff. The pgvector value isn't calibrated on real duplicates yet — revisit.
// (similar-issues-hint.tsx keeps a 0.7 client-side safety net.)
const SIMILARITY_THRESHOLD_BY_PROVIDER = { upstash: 0.7, pgvector: 0.8 } as const;

export async function handleGetSimilarIssues(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const q = url.searchParams.get("q");
  const kindParam = url.searchParams.get("kind");
  const kind = kindParam === "bug" || kindParam === "feature" ? kindParam : undefined;

  if (!slug || !q?.trim()) return Response.json([]);

  const linearSlug = await resolveLinearSlug("portal", slug);
  if (!linearSlug) return Response.json([]);

  const [matches, provider] = await Promise.all([
    queryTopIssueMatches(linearSlug, q.trim(), 3, kind),
    resolveVectorProvider(linearSlug),
  ]);
  const threshold = SIMILARITY_THRESHOLD_BY_PROVIDER[provider];
  return Response.json(matches.filter((m) => m.score >= threshold));
}

export async function handleMarkIssueSeen(req: Request): Promise<Response> {
  const { issueId, userId } = await req.json();

  if (!issueId || !userId) {
    return Response.json({ error: "Missing issueId or userId" }, { status: 400 });
  }

  await markIssueViewed(issueId, userId);
  return Response.json({ success: true });
}

export async function handleAddComment(req: Request): Promise<Response> {
  const schema = "portal";
  const { issueId, question, ownerEmail, slug, issueCode, issueType, type } = await req.json();

  if (!issueId || !question || !ownerEmail) {
    return Response.json(
      { error: "Missing issueId, question, or ownerEmail" },
      { status: 400 },
    );
  }

  // 'requirement_update' is a plain statement (no answer flow) — see
  // 20260921190000_add_type_to_decisions.sql. Anything else falls back to
  // the original ask/answer 'question' type.
  const decisionType = type === "requirement_update" ? "requirement_update" : "question";

  const supabaseUrl = Deno.env.get("PROJECT_URL")!;
  const serviceKey = Deno.env.get("SERVICE_SECRET_KEY")!;

  // Save to Supabase
  const res = await fetch(`${supabaseUrl}/rest/v1/decisions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "return=representation",
      "Content-Profile": schema,
    },
    body: JSON.stringify({ issue_id: issueId, owner_email: ownerEmail, question, type: decisionType }),
  });

  const data = await res.json();

  if (!res.ok) {
    return Response.json({ error: "Failed to create decision", details: data }, { status: 500 });
  }

  await markIssueUpdated(issueId, ownerEmail);
  if (slug) {
    // Fire-and-forget so notifications don't delay the response.
    EdgeRuntime.waitUntil(notifyProject({
      slug,
      actorEmail: ownerEmail,
      action: decisionType === "requirement_update" ? "requirement_update_added" : "decision_requested",
      objectType: "issue_decision",
      objectId: (data[0] ?? data)?.id ?? issueId,
      link: resolveIssueDashboardLink(slug, issueType),
      preview: question,
      issueCode,
      issueId,
    }));
  }

  return Response.json(data[0] ?? data);
}

// Posts a decision to the ticket as a comment (Linear or Jira) and marks it
// posted. The route keeps its old name (/linear-comment).
export async function handlePostToLinear(req: Request): Promise<Response> {
  const schema = "portal";
  const { issueId, decisionId, decisionBody, decisionEmail } = await req.json();

  if (!issueId || !decisionId || !decisionBody) {
    return Response.json(
      { error: "Missing issueId, decisionId, or decisionBody" },
      { status: 400 },
    );
  }

  const supabaseUrl = Deno.env.get("PROJECT_URL")!;
  const serviceKey = Deno.env.get("SERVICE_SECRET_KEY")!;

  const body = `${decisionBody}\n\n— ${decisionEmail}`;

  let comment;
  try {
    const tickets = await ticketsForId(issueId);
    comment = await tickets.addComment(issueId, body);
  } catch (err) {
    return ticketErrorResponse(err);
  }

  await fetch(`${supabaseUrl}/rest/v1/decisions?id=eq.${decisionId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Profile": schema,
    },
    body: JSON.stringify({ posted_to_linear: true }),
  });

  return Response.json(comment);
}

export async function handleSetDecision(req: Request): Promise<Response> {
  const schema = "portal";
  const { decisionId, decision, decisionEmail, slug, issueCode, issueType } = await req.json();

  if (!decisionId || !decision || !decisionEmail) {
    return Response.json(
      { error: "Missing decisionId, decision, or decisionEmail" },
      { status: 400 },
    );
  }

  const supabaseUrl = Deno.env.get("PROJECT_URL")!;
  const serviceKey = Deno.env.get("SERVICE_SECRET_KEY")!;

  // Save answer, mark as closed and posted
  const res = await fetch(
    `${supabaseUrl}/rest/v1/decisions?id=eq.${decisionId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=representation",
        "Content-Profile": schema,
      },
      body: JSON.stringify({
        decision,
        decision_by: decisionEmail,
        decided_at: new Date().toISOString(),
        status: true,
        posted_to_linear: true,
      }),
    },
  );

  const updated = await res.json();
  if (!res.ok) {
    return Response.json({ error: "Failed to set decision", details: updated }, { status: 500 });
  }

  const row = updated[0] ?? updated;

  // Post question + answer together on the ticket (non-fatal if it fails).
  try {
    const getRes = await fetch(
      `${supabaseUrl}/rest/v1/decisions?id=eq.${decisionId}&select=question,owner_email`,
      {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Accept-Profile": schema },
      },
    );
    const [decisionRow] = await getRes.json();

    const question = decisionRow?.question ?? "";
    const ownerEmail = decisionRow?.owner_email ?? "";

    const commentBody =
      `❓ **Question** from ${ownerEmail}:\n\n${question}\n\n` +
      `✅ **Decision** from ${decisionEmail}:\n\n${decision}`;

    const tickets = await ticketsForId(row.issue_id);
    await tickets.addComment(row.issue_id, commentBody);
  } catch (err) {
    console.error("[handleSetDecision] ticket comment error (non-fatal):", err);
  }

  await markIssueUpdated(row.issue_id, decisionEmail);
  if (slug) {
    // Fire-and-forget so notifications don't delay the response.
    EdgeRuntime.waitUntil(notifyProject({
      slug,
      actorEmail: decisionEmail,
      action: "decision_answered",
      objectType: "issue_decision",
      objectId: row.id,
      link: resolveIssueDashboardLink(slug, issueType),
      preview: decision,
      issueCode,
      issueId: row.issue_id,
    }));
  }

  return Response.json(row);
}

// Admins/developers only, and only while the question is unanswered — once
// answered it's part of the record. Questions only, not requirement updates.
export async function handleDeleteDecision(req: Request): Promise<Response> {
  const schema = "portal";
  const { decisionId, requesterEmail } = await req.json();

  if (!decisionId || !requesterEmail) {
    return Response.json(
      { error: "Missing decisionId or requesterEmail" },
      { status: 400 },
    );
  }

  const { data: requester, error: requesterError } = await supabase.schema(schema)
    .from("users")
    .select("role")
    .eq("email", requesterEmail)
    .maybeSingle();
  if (requesterError || !requester || !["admin", "developer"].includes(requester.role)) {
    return Response.json(
      { error: "Only admins or developers can delete a question" },
      { status: 403 },
    );
  }

  const { data: existing, error: existingError } = await supabase.schema(schema)
    .from("decisions")
    .select("id, decision")
    .eq("id", decisionId)
    .maybeSingle();
  if (existingError || !existing) {
    return Response.json({ error: "Question not found" }, { status: 404 });
  }
  if (existing.decision != null) {
    return Response.json(
      { error: "Can't delete a question that's already been answered" },
      { status: 409 },
    );
  }

  const { error: deleteError } = await supabase.schema(schema)
    .from("decisions")
    .delete()
    .eq("id", decisionId);
  if (deleteError) {
    return Response.json(
      { error: "Failed to delete question", details: deleteError.message },
      { status: 500 },
    );
  }

  return Response.json({ success: true, decisionId });
}

// ─── Projects, Milestones & Labels ───────────────────────────────────────────

export async function handleGetProjects(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const initiativeId = url.searchParams.get("initiativeId");

  try {
    if (slug) {
      // An unknown customer has no projects to pick from.
      const customer = await customerBySlug(slug);
      if (!customer) return Response.json([]);
      return Response.json(await ticketsForCustomer(customer).listProjects());
    }

    if (!initiativeId) return Response.json({ error: "Missing slug or initiativeId" }, { status: 400 });

    // Admin pages pick a Linear initiative directly.
    return Response.json(await linearTickets(null).listInitiativeProjects(initiativeId));
  } catch (err) {
    return ticketErrorResponse(err);
  }
}

export async function handleGetMilestones(req: Request): Promise<Response> {
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) return Response.json({ error: "Missing projectId" }, { status: 400 });

  try {
    const tickets = await ticketsForId(projectId);
    return Response.json(await tickets.listMilestones(projectId));
  } catch (err) {
    return ticketErrorResponse(err);
  }
}

export async function handleGetLabels(req: Request): Promise<Response> {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return Response.json({ error: "Missing slug" }, { status: 400 });

  try {
    const customer = await customerBySlug(slug);
    if (!customer) return Response.json([]);
    return Response.json(await ticketsForCustomer(customer).listLabels());
  } catch (err) {
    return ticketErrorResponse(err);
  }
}

export async function handleCreateMilestone(req: Request): Promise<Response> {
  const { projectId, name, targetDate, description } = await req.json();
  if (!projectId || !name) return Response.json({ error: "Missing projectId or name" }, { status: 400 });

  try {
    const tickets = await ticketsForId(projectId);
    return Response.json(await tickets.createMilestone({ projectId, name, targetDate, description }));
  } catch (err) {
    return ticketErrorResponse(err);
  }
}
