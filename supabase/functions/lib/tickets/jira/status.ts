// @ts-nocheck
// Jira statuses ↔ the portal's workflow states (Spark & Co's Linear flow:
// Backlog → Planning → Business Review → Development → QA → UAT → Done).
//
// Agreed rule (2026-11-01): a Jira status with the same name as a portal
// state is that state (case-insensitive, plus a few common synonyms);
// anything else goes by its Jira category — to do → Backlog, in progress →
// Development, done → Done. So a customer who adds "Business Review", "QA"
// or "UAT" columns to their board gets those portal flows; one who doesn't
// still sees every ticket. No Deno imports (unit-tested).

export type JiraStatus = { name?: string; statusCategory?: { key?: string } };

// Portal state → the Jira status names that mean it.
const SYNONYMS: Record<string, string[]> = {
  Backlog: ["backlog"],
  Todo: ["todo", "to do", "to-do", "open", "selected for development"],
  Planning: ["planning"],
  "Business Review": ["business review"],
  Development: ["development", "in development", "dev"],
  "In Progress": ["in progress"],
  "In Review": ["in review", "code review", "review", "peer review"],
  QA: ["qa", "in qa", "testing", "in testing", "quality assurance"],
  UAT: ["uat", "user acceptance", "user acceptance testing", "acceptance"],
  Blocked: ["blocked", "on hold"],
  Approved: ["approved"],
  Done: ["done", "closed", "resolved", "complete", "completed", "released"],
  Canceled: ["canceled", "cancelled", "won't do", "wont do", "won't fix", "rejected", "duplicate"],
};

const BY_NAME = new Map<string, string>();
for (const [portal, names] of Object.entries(SYNONYMS)) for (const name of names) BY_NAME.set(name, portal);

const CATEGORY_FALLBACK: Record<string, string> = { new: "Backlog", indeterminate: "Development", done: "Done" };

export function portalStateName(status: JiraStatus | null | undefined): string {
  const byName = BY_NAME.get(String(status?.name ?? "").trim().toLowerCase());
  if (byName) return byName;
  return CATEGORY_FALLBACK[status?.statusCategory?.key ?? ""] ?? "Backlog";
}

// The Jira category a portal state belongs to.
export function jiraCategoryOf(portalState: string): "new" | "indeterminate" | "done" {
  if (["Backlog", "Todo", "Planning", "Not Started"].includes(portalState)) return "new";
  if (["Done", "Approved", "Completed", "Canceled"].includes(portalState)) return "done";
  return "indeterminate";
}

export type JiraTransition = { id: string; name?: string; to?: JiraStatus };

// The transition that moves a ticket to `portalState`: one whose target
// status is that state by name; failing that, the first one into the same
// category (e.g. "Development" → SPA's "En curso"). Null when none fits.
export function pickTransition(transitions: JiraTransition[], portalState: string): JiraTransition | null {
  const exact = transitions.find((t) => portalStateName({ name: t.to?.name }) === portalState && BY_NAME.has(String(t.to?.name ?? "").trim().toLowerCase()));
  if (exact) return exact;
  const category = jiraCategoryOf(portalState);
  return transitions.find((t) => t.to?.statusCategory?.key === category) ?? null;
}
