// @ts-nocheck
// Talking to a customer's Jira Cloud site: Basic auth with the account email
// and its API token (REST API v3). The token comes from Vault, per customer.
import { supabase } from "../../client.ts";
import { describeJiraNetworkError, describeJiraResponse, type JiraSettings } from "./ticketSystem.ts";

const REQUEST_TIMEOUT_MS = 15_000;

export function jiraHeaders(settings: JiraSettings, token: string) {
  return {
    Authorization: `Basic ${btoa(`${settings.email}:${token}`)}`,
    Accept: "application/json",
  };
}

async function jiraGet(settings: JiraSettings, token: string, path: string) {
  return await fetch(`${settings.base_url}${path}`, {
    headers: jiraHeaders(settings, token),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

export type JiraConnectionResult =
  | { ok: true; accountName: string; projectName: string }
  | { ok: false; error: string };

// Checks the credentials, then that the project exists and the account sees it.
export async function testJiraConnection(settings: JiraSettings, token: string, projectKey: string): Promise<JiraConnectionResult> {
  try {
    const me = await jiraGet(settings, token, "/rest/api/3/myself");
    if (!me.ok) return { ok: false, error: describeJiraResponse(me.status, "account") };
    const account = await me.json().catch(() => null);
    if (!account?.accountId) return { ok: false, error: "That address doesn't look like a Jira site. Check the URL." };

    const project = await jiraGet(settings, token, `/rest/api/3/project/${encodeURIComponent(projectKey)}`);
    if (!project.ok) return { ok: false, error: describeJiraResponse(project.status, "project", projectKey) };
    const projectBody = await project.json();

    return { ok: true, accountName: account.displayName ?? settings.email, projectName: projectBody.name ?? projectKey };
  } catch (err) {
    console.error("[tickets] Jira connection test failed", { base_url: settings.base_url, error: String(err?.message ?? err) });
    return { ok: false, error: describeJiraNetworkError(err, settings.base_url) };
  }
}

// ── Token (Vault) ─────────────────────────────────────────────────────────

export async function getTicketToken(customerId: string): Promise<string | null> {
  const { data, error } = await supabase.schema("portal").rpc("get_ticket_token", { p_customer_id: customerId });
  if (error) throw new Error(`Couldn't read the ticket system token: ${error.message}`);
  return data ?? null;
}

export async function setTicketToken(customerId: string, token: string): Promise<void> {
  const { error } = await supabase.schema("portal").rpc("set_ticket_token", { p_customer_id: customerId, p_token: token });
  if (error) throw new Error(`Couldn't save the ticket system token: ${error.message}`);
}

export async function deleteTicketToken(customerId: string): Promise<void> {
  const { error } = await supabase.schema("portal").rpc("delete_ticket_token", { p_customer_id: customerId });
  if (error) throw new Error(`Couldn't remove the ticket system token: ${error.message}`);
}
