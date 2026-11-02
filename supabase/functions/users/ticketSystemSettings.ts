// @ts-nocheck
// A customer's ticket system as set from Add/Edit Customer: Linear (the
// default, the portal's own workspace) or Jira (the customer's own site,
// with their account email + API token). See lib/tickets/ticketSystem.ts for
// where each piece is stored.
import { supabase } from "../client.ts";
import type { TestRun } from "../lib/testMode.ts";
import { isTicketSystem, parseJiraInput, ticketSystemOf, type JiraSettings, type TicketSystem } from "../lib/tickets/ticketSystem.ts";
import { deleteTicketToken, getTicketToken, setTicketToken, testJiraConnection } from "../lib/tickets/jiraConnection.ts";

// The customer's stored token, for a form that left the token blank. Only
// sent back to the Jira site it was saved for: a changed URL needs the token
// typed again, so a stored token never goes to a new address.
async function storedTokenFor(customerId: string | null, baseUrl: string): Promise<string | null> {
  if (!customerId) return null;
  const { data, error } = await supabase.schema("portal").from("customers").select("systems").eq("customer_id", customerId).maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.systems?.jira?.base_url !== baseUrl) return null;
  return await getTicketToken(customerId);
}

export type TicketSystemChange =
  | { system: "linear"; projectId: string }
  | { system: "jira"; projectId: string; settings: JiraSettings; token: string | null; tokenChanged: boolean };

// Reads and checks the ticket-system part of a request body. For Jira it
// also tests the connection, so nothing is saved with credentials that don't
// work. Without a new token, the customer's stored one is used (editing).
export async function resolveTicketSystem(
  body: any,
  projectId: unknown,
  existingCustomerId: string | null = null,
): Promise<TicketSystemChange> {
  const system: TicketSystem = body?.ticket_system ?? "linear";
  if (!isTicketSystem(system)) throw new Error(`Unknown ticket system "${system}"`);

  if (system === "linear") {
    const slug = typeof projectId === "string" ? projectId.trim() : "";
    if (!slug) throw new Error("linear_slug required");
    return { system, projectId: slug };
  }

  const parsed = parseJiraInput(body?.jira, projectId);
  if ("error" in parsed) throw new Error(parsed.error);

  const token = parsed.token ?? (await storedTokenFor(existingCustomerId, parsed.settings.base_url));
  if (!token) throw new Error("Enter the Jira API token");

  const test = await testJiraConnection(parsed.settings, token, parsed.projectKey);
  if (!test.ok) throw new Error(test.error);

  return { system, projectId: parsed.projectKey, settings: parsed.settings, token, tokenChanged: !!parsed.token };
}

// `systems` with the ticket system applied, leaving chat/vector untouched.
export function applyTicketSystem(systems: any, change: TicketSystemChange) {
  const next = { ...systems, tickets: change.system };
  if (change.system === "jira") next.jira = change.settings;
  else delete next.jira;
  return next;
}

// Saves `systems` and the token (Vault) for a customer row that already
// exists. In test mode both are only recorded.
export async function saveTicketSystem(
  schema: string,
  customerId: string,
  currentSystems: any,
  change: TicketSystemChange,
  testRun: TestRun | null = null,
) {
  const systems = applyTicketSystem(currentSystems, change);

  if (testRun) {
    testRun.writes.push({ target: `${schema}.customers`, op: "update", data: { customer_id: customerId, systems } });
    if (change.system === "jira" && change.tokenChanged) {
      testRun.writes.push({ target: "vault.ticket_token", op: "set", data: { customer_id: customerId } });
    }
    return systems;
  }

  // Token first: a Jira customer without a token couldn't load anything.
  if (change.system === "jira" && change.tokenChanged) await setTicketToken(customerId, change.token!);

  const { error } = await supabase.schema(schema).from("customers").update({ systems }).eq("customer_id", customerId);
  if (error) throw new Error(error.message);

  if (change.system === "linear" && ticketSystemOf(currentSystems) !== "linear") await deleteTicketToken(customerId);
  return systems;
}

// "Test connection" in the form, before saving.
export async function testTicketConnection(body: any) {
  if (body?.ticket_system !== "jira") throw new Error("Only Jira connections can be tested");

  const parsed = parseJiraInput(body?.jira, body?.project_key);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const customerId = typeof body?.customer_id === "string" ? body.customer_id : null;
  const token = parsed.token ?? (await storedTokenFor(customerId, parsed.settings.base_url));
  if (!token) return { ok: false, error: "Enter the Jira API token" };

  return await testJiraConnection(parsed.settings, token, parsed.projectKey);
}
