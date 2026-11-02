// @ts-nocheck
// The ticket-system wrapper. Every call that used to go straight to Linear
// asks this for the right adapter instead:
//   ticketsForSlug(slug) — a customer's page (list tickets, create one…)
//   ticketsForId(id)     — a request that only carries a ticket/project id
//   ticketsForCustomer(row)
// The adapter is chosen from `customers.systems.tickets` (missing = Linear).
// Linear and Jira adapters take and return the same shapes.
import { supabase } from "../../client.ts";
import { escapeIlike } from "../../utils/slug.ts";
import { TicketError, type TicketCustomer } from "./errors.ts";
import { parseTicketId } from "./ids.ts";
import { ticketSystemOf } from "./ticketSystem.ts";
import { linearTickets, type TicketsAdapter } from "./linear/issues.ts";
import { jiraTickets } from "./jira/issues.ts";
import { linearRoadmap, type RoadmapAdapter } from "./linear/roadmap.ts";
import { jiraRoadmap } from "./jira/roadmap.ts";

const CUSTOMER_COLUMNS = "customer_id, clientName, linear_slug, linear_projects, systems";

// `slug` is the customer's URL name (clientName, matched case-insensitively).
export async function customerBySlug(slug: string): Promise<TicketCustomer | null> {
  const { data, error } = await supabase
    .schema("portal")
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .ilike("clientName", escapeIlike(slug))
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function customerById(customerId: string): Promise<TicketCustomer | null> {
  const { data, error } = await supabase.schema("portal").from("customers").select(CUSTOMER_COLUMNS).eq("customer_id", customerId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export function ticketsForCustomer(customer: TicketCustomer): TicketsAdapter {
  return ticketSystemOf(customer.systems) === "jira" ? jiraTickets(customer) : linearTickets(customer);
}

export async function ticketsForSlug(slug: string): Promise<{ customer: TicketCustomer; tickets: TicketsAdapter }> {
  const customer = await customerBySlug(slug);
  if (!customer) throw new TicketError("Customer not found", 404);
  return { customer, tickets: ticketsForCustomer(customer) };
}

// The Jira customer a `jira:…` id belongs to.
async function jiraCustomerOf(customerId: string): Promise<TicketCustomer> {
  const customer = await customerById(customerId);
  if (!customer || ticketSystemOf(customer.systems) !== "jira") throw new TicketError("Ticket not found", 404);
  return customer;
}

// A Linear id needs no customer (one workspace); a Jira id names its own.
export async function ticketsForId(id: string): Promise<TicketsAdapter> {
  const parsed = parseTicketId(id);
  if (parsed.system === "linear") return linearTickets(null);
  return jiraTickets(await jiraCustomerOf(parsed.customerId));
}

// ── Roadmap ───────────────────────────────────────────────────────────────

export function roadmapForCustomer(customer: TicketCustomer): RoadmapAdapter {
  return ticketSystemOf(customer.systems) === "jira" ? jiraRoadmap(customer) : linearRoadmap(customer);
}

// For requests that only carry a cycle / project / milestone id.
export async function roadmapForId(id: string): Promise<RoadmapAdapter> {
  const parsed = parseTicketId(id);
  if (parsed.system === "linear") return linearRoadmap(null);
  return jiraRoadmap(await jiraCustomerOf(parsed.customerId));
}
