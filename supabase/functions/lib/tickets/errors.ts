// @ts-nocheck
// Shared by the ticket-system adapters. No Deno imports.

// The `customers` columns the adapters read.
export type TicketCustomer = {
  customer_id: string;
  clientName?: string | null;
  linear_slug: string | null;
  linear_projects?: string[] | null;
  systems?: Record<string, any> | null;
};

// A failure with the HTTP status the handler should answer with, and a
// message meant for the person using the portal.
export class TicketError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "TicketError";
    this.status = status;
  }
}

// What a handler answers when something threw: a TicketError keeps its
// status and message; anything else is re-thrown (the function's own 500).
export function ticketErrorResponse(err: unknown): Response {
  if (err instanceof TicketError) return Response.json({ error: err.message }, { status: err.status });
  throw err;
}
