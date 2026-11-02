// @ts-nocheck
// Ids the portal hands out for tickets, projects, milestones and cycles.
//
// Linear ids are passed through untouched (every id stored before the
// wrapper existed stays valid). Ids from a customer's own ticket system carry
// where they came from — `jira:{customer_id}:{native id}`, e.g.
// `jira:6f1c…:SPA-12` — so a request that only has an id (change a ticket's
// status, list its attachments…) still knows which system and which
// customer's credentials to use. No Deno imports: unit-tested from Node.

export type ParsedTicketId =
  | { system: "linear"; nativeId: string }
  | { system: "jira"; customerId: string; nativeId: string };

const JIRA_ID_RE = /^jira:([0-9a-f-]{36}):(.+)$/i;

export function jiraId(customerId: string, nativeId: string | number): string {
  return `jira:${customerId}:${nativeId}`;
}

export function parseTicketId(id: string): ParsedTicketId {
  const match = JIRA_ID_RE.exec(id ?? "");
  if (match) return { system: "jira", customerId: match[1], nativeId: match[2] };
  return { system: "linear", nativeId: id };
}
