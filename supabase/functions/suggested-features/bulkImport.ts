// @ts-nocheck
// POST /suggested-features/bulk-import — { slug, notes, actorEmail }
// Turns pasted feedback notes into draft tickets with the AI. Creates
// nothing: the portal shows the drafts for review and files the ones the
// person keeps through POST /issues/create, like any other ticket.
//
// Goes through the ticket-system wrapper, so it works for Linear and Jira
// customers alike. `slug` is the route slug, resolved server-side; project
// and milestone ids the model returns are checked against that customer's
// own lists (bulkImportPrompt.ts → sanitizeDrafts).
import { supabase } from "../client.ts";
import { AiBusyError, aiEnabled, requestJson } from "../lib/aiClient.ts";
import { consumeRateLimit, describeRetryAfter } from "../lib/rateLimit.ts";
import { ticketsForSlug } from "../lib/tickets/provider.ts";
import { ticketErrorResponse } from "../lib/tickets/errors.ts";
import { runWithConcurrency } from "../utils/concurrency.ts";
import {
  BULK_IMPORT_SCHEMA,
  MAX_NOTES_CHARS,
  MIN_NOTES_CHARS,
  buildBulkImportPrompt,
  sanitizeDrafts,
  type BulkProject,
} from "./bulkImportPrompt.ts";

// Each analysis is one large AI call. Per person, and per customer so a
// team can't multiply it across accounts.
const USER_LIMIT = { limit: 10, windowSeconds: 60 * 60 };
const CUSTOMER_LIMIT = { limit: 40, windowSeconds: 24 * 60 * 60 };

async function isPortalUser(email: string): Promise<boolean> {
  const { data, error } = await supabase.schema("portal").from("users").select("email").eq("email", email).maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

async function customerProjects(tickets): Promise<BulkProject[]> {
  const projects: { id: string; name: string }[] = await tickets.listProjects();
  const withMilestones: BulkProject[] = [];
  await runWithConcurrency(projects, 4, async (p) => {
    let milestones = [];
    try {
      milestones = (await tickets.listMilestones(p.id)).map((m) => ({ id: m.id, name: m.name }));
    } catch (err) {
      // The project can still be picked; only its milestones are missing.
      console.error(`[bulk-import] Failed to load milestones for ${p.id}`, err);
    }
    withMilestones.push({ id: p.id, name: p.name, milestones });
  });
  // Same order as the project picker.
  const order = new Map(projects.map((p, i) => [p.id, i]));
  return withMilestones.sort((a, b) => order.get(a.id) - order.get(b.id));
}

// index.ts rebuilds every response with only the CORS headers, so the wait
// goes in the message (and the body) rather than a Retry-After header.
const tooMany = (message: string, retryAfterSeconds: number) =>
  Response.json({ error: message, retryAfterSeconds }, { status: 429 });

export async function handleBulkImport(req: Request): Promise<Response> {
  const { slug, notes, actorEmail } = await req.json();
  const text = typeof notes === "string" ? notes.trim() : "";

  if (!slug || !actorEmail) {
    return Response.json({ error: "Missing slug or actorEmail" }, { status: 400 });
  }
  if (text.length < MIN_NOTES_CHARS) {
    return Response.json({ error: "Paste a bit more of your notes so there's something to turn into tickets." }, { status: 400 });
  }
  if (text.length > MAX_NOTES_CHARS) {
    return Response.json(
      { error: `Those notes are too long (${text.length.toLocaleString("en-US")} characters). Import them in parts of up to ${MAX_NOTES_CHARS.toLocaleString("en-US")}.` },
      { status: 413 },
    );
  }
  if (!aiEnabled()) {
    return Response.json({ error: "AI features aren't set up on this portal yet." }, { status: 503 });
  }
  if (!(await isPortalUser(actorEmail))) {
    return Response.json({ error: "Unknown user" }, { status: 403 });
  }

  let customer;
  let tickets;
  try {
    ({ customer, tickets } = await ticketsForSlug(slug));
  } catch (err) {
    return ticketErrorResponse(err);
  }

  const userLimit = await consumeRateLimit(
    `bulk-import:user:${String(actorEmail).toLowerCase()}`,
    USER_LIMIT.limit,
    USER_LIMIT.windowSeconds,
  );
  if (!userLimit.allowed) {
    return tooMany(
      `You've run ${USER_LIMIT.limit} bulk imports in the last hour. Try again ${describeRetryAfter(userLimit.retryAfterSeconds)}.`,
      userLimit.retryAfterSeconds,
    );
  }
  const customerLimit = await consumeRateLimit(
    `bulk-import:customer:${customer.customer_id}`,
    CUSTOMER_LIMIT.limit,
    CUSTOMER_LIMIT.windowSeconds,
  );
  if (!customerLimit.allowed) {
    return tooMany(
      `Your team has reached today's limit of ${CUSTOMER_LIMIT.limit} bulk imports. Try again ${describeRetryAfter(customerLimit.retryAfterSeconds)}.`,
      customerLimit.retryAfterSeconds,
    );
  }

  let projects: BulkProject[];
  try {
    projects = await customerProjects(tickets);
  } catch (err) {
    return ticketErrorResponse(err);
  }

  try {
    const raw = await requestJson(buildBulkImportPrompt(text, projects), BULK_IMPORT_SCHEMA);
    return Response.json({ drafts: sanitizeDrafts(raw, projects) });
  } catch (err) {
    if (err instanceof AiBusyError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }
}
