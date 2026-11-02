// @ts-nocheck
// Reading tickets, through the ticket-system wrapper (Linear or the
// customer's Jira — see lib/tickets/provider.ts).
import { ticketErrorResponse, TicketError } from "../lib/tickets/errors.ts";
import { ticketsForId, ticketsForSlug } from "../lib/tickets/provider.ts";
import { attachRequesters } from "./issueRequests.ts";

// Backs the "Edit this instead" action on the similar-issues hint — the vector match
// only carries { id, title } metadata, so this fetches the rest of the Issue shape
// EditIssueModal needs by id (no project/customer filtering: a direct lookup).
export async function handleGetIssueById(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  try {
    const tickets = await ticketsForId(id);
    const issue = await tickets.getIssue(id);
    if (!issue) return Response.json({ error: "Issue not found" }, { status: 404 });

    const [withRequester] = await attachRequesters([issue]);
    return Response.json(withRequester);
  } catch (err) {
    return ticketErrorResponse(err);
  }
}

export async function handleGetIssues(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);

  const rawSlug = searchParams.get("linear_slug") ?? searchParams.get("slug");
  const slug = rawSlug ? decodeURIComponent(rawSlug) : null;
  if (!slug) return Response.json({ error: "Missing linear_slug" }, { status: 400 });

  const rawStatuses = searchParams.get("ticket_statuses");
  const ticketStatuses = rawStatuses
    ? rawStatuses
        .split(",")
        .map((s) => decodeURIComponent(s.trim()))
        .filter(Boolean)
    : undefined;

  try {
    const { tickets } = await ticketsForSlug(slug).catch((err) => {
      // Kept from before: an unknown customer is a 500 "Customer not found".
      if (err instanceof TicketError && err.status === 404) throw new Error("Customer not found");
      throw err;
    });
    const issues = await attachRequesters(await tickets.listIssues(ticketStatuses));
    return Response.json(issues);
  } catch (err) {
    return ticketErrorResponse(err);
  }
}
