// @ts-nocheck
// Which ticket system a customer uses, and checking the Jira details an admin
// types in. No Deno or network imports, so the Node unit tests can load it.
//
// Stored on `customers.systems` (jsonb, no constraint on purpose):
//   tickets: "linear" | "jira"   — missing means "linear" (every older customer)
//   jira:    { base_url, email } — only for Jira; the API token is in Vault
//                                  (portal.set_ticket_token / get_ticket_token)
// The customer's id in that system (Linear slug, Jira project key) stays in
// `customers.linear_slug`.

export const TICKET_SYSTEMS = ["linear", "jira"] as const;
export type TicketSystem = (typeof TICKET_SYSTEMS)[number];

export type JiraSettings = { base_url: string; email: string };

export function ticketSystemOf(systems: any): TicketSystem {
  return systems?.tickets === "jira" ? "jira" : "linear";
}

export function isTicketSystem(value: unknown): value is TicketSystem {
  return TICKET_SYSTEMS.includes(value as TicketSystem);
}

// "acme.atlassian.net", "https://acme.atlassian.net/jira/software/..." →
// "https://acme.atlassian.net". Only the site's address is kept.
export function normalizeJiraBaseUrl(input: unknown): string | null {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== "https:" || !url.hostname.includes(".")) return null;
    return `https://${url.host.toLowerCase()}`;
  } catch {
    return null;
  }
}

// Jira project keys: a capital letter, then capitals, digits or "_" (ACME, WEB2).
export function normalizeJiraProjectKey(input: unknown): string | null {
  const key = typeof input === "string" ? input.trim().toUpperCase() : "";
  return /^[A-Z][A-Z0-9_]{0,9}$/.test(key) ? key : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The Jira details from a request body, checked. `error` is for the admin.
export function parseJiraInput(
  jira: any,
  projectKey: unknown,
): { settings: JiraSettings; projectKey: string; token: string | null } | { error: string } {
  const base_url = normalizeJiraBaseUrl(jira?.base_url);
  if (!base_url) return { error: "Enter the Jira URL, e.g. https://acme.atlassian.net" };

  const email = typeof jira?.email === "string" ? jira.email.trim() : "";
  if (!EMAIL_RE.test(email)) return { error: "Enter the email of the Jira account the portal connects with" };

  const key = normalizeJiraProjectKey(projectKey);
  if (!key) return { error: "Enter the Jira project key — the letters before the ticket numbers, e.g. ACME for ACME-12" };

  const token = typeof jira?.api_token === "string" && jira.api_token.trim() ? jira.api_token.trim() : null;
  return { settings: { base_url, email }, projectKey: key, token };
}

// A failed Jira response, in words an admin can act on.
export function describeJiraResponse(status: number, step: "account" | "project", projectKey = ""): string {
  if (status === 401) {
    return "Jira refused the email and API token. Check both — tokens are created at id.atlassian.com → Security → API tokens, and they expire.";
  }
  if (status === 403) return "This Jira account isn't allowed to use the API (it may need product access to Jira).";
  if (step === "project" && status === 404) {
    return `Project "${projectKey}" doesn't exist in this Jira, or the account can't see it.`;
  }
  if (status === 404) return "That address doesn't look like a Jira site. Check the URL.";
  if (status === 429) return "Jira is rate-limiting requests right now. Try again in a minute.";
  return `Jira answered with an error (${status}).`;
}

export function describeJiraNetworkError(err: any, baseUrl: string): string {
  const message = String(err?.message ?? err ?? "");
  if (err?.name === "TimeoutError" || /timed? ?out/i.test(message)) return `${baseUrl} didn't answer in time. Check the URL.`;
  if (/dns|lookup|not known|ENOTFOUND|resolve/i.test(message)) return `Couldn't find ${baseUrl}. Check the URL.`;
  return `Couldn't reach ${baseUrl}: ${message}`;
}
