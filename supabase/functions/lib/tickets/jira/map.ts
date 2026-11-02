// @ts-nocheck
// A Jira issue → the portal's ticket shape (the one the Linear adapter
// returns, which the pages are built on). No Deno imports (unit-tested).
//
// What maps to what: the customer = a Jira project; Linear "project" = the
// ticket's parent Epic; cycle = Sprint; estimate = story points; Bug /
// feature = the issue type, exposed as a "bug" / "feature" label because
// that's how the pages tell them apart.
import { adfToMarkdown } from "./adf.ts";
import { jiraId } from "../ids.ts";
import { portalStateName } from "./status.ts";

export type JiraMapContext = {
  customerId: string;
  baseUrl: string;
  // Custom field ids differ per Jira site (found from /rest/api/3/field).
  sprintField: string | null;
  storyPointFields: string[];
};

// Jira priorities → the portal's labels and sort order (Linear's).
const PRIORITY: Record<string, { label: string; order: number }> = {
  highest: { label: "Urgent", order: 1 },
  blocker: { label: "Urgent", order: 1 },
  critical: { label: "Urgent", order: 1 },
  high: { label: "High", order: 2 },
  medium: { label: "Medium", order: 3 },
  low: { label: "Low", order: 4 },
  lowest: { label: "Low", order: 4 },
  minor: { label: "Low", order: 4 },
  trivial: { label: "Low", order: 4 },
};

// Portal priority value ("urgent"…"none") → Jira priority name.
export const JIRA_PRIORITY_NAME: Record<string, string | null> = {
  urgent: "Highest",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: null,
};

// Jira labels have no colour: a stable one from the name, so a label looks
// the same everywhere.
const LABEL_COLORS = ["#f87171", "#fb923c", "#facc15", "#4ade80", "#2dd4bf", "#60a5fa", "#a78bfa", "#f472b6"];
export function labelColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return LABEL_COLORS[hash % LABEL_COLORS.length];
}

export function portalLabel(name: string) {
  return { id: name, name, color: labelColor(name) };
}

// The issue type as the label the pages look for.
export function typeLabel(issueTypeName: string | undefined): string | null {
  const type = String(issueTypeName ?? "").toLowerCase();
  if (type === "bug") return "bug";
  if (type === "story" || type === "feature" || type === "new feature" || type === "improvement") return "feature";
  return null;
}

export function issueNumber(key: string): number {
  return Number(String(key).split("-").pop()) || 0;
}

// Jira's sprint field → the portal's cycle. A ticket can have been in
// several sprints; the open one wins, else the latest.
export function sprintToCycle(sprints: any[] | null | undefined, customerId: string) {
  if (!Array.isArray(sprints) || sprints.length === 0) return null;
  const sprint = sprints.find((s) => s.state === "active") ?? sprints.find((s) => s.state === "future") ?? sprints[sprints.length - 1];
  return {
    id: jiraId(customerId, `sprint:${sprint.id}`),
    name: sprint.name ?? null,
    number: sprint.id,
    startsAt: sprint.startDate ?? null,
    endsAt: sprint.endDate ?? null,
    isActive: sprint.state === "active",
    isPast: sprint.state === "closed",
    isFuture: sprint.state === "future",
  };
}

function storyPoints(fields: any, ctx: JiraMapContext): number | null {
  for (const id of ctx.storyPointFields) {
    const value = fields?.[id];
    if (typeof value === "number") return value;
  }
  return null;
}

export function isEpic(issue: any): boolean {
  const type = issue?.fields?.issuetype;
  return type?.hierarchyLevel === 1 || String(type?.name ?? "").toLowerCase() === "epic";
}

export function mapComment(comment: any) {
  return {
    id: String(comment.id),
    body: adfToMarkdown(comment.body),
    createdAt: comment.created,
    displayName: comment.author?.displayName ?? null,
  };
}

export function mapIssue(issue: any, ctx: JiraMapContext) {
  const f = issue.fields ?? {};
  const state = portalStateName(f.status);
  const priority = PRIORITY[String(f.priority?.name ?? "").toLowerCase()];
  const labels = [...new Set([typeLabel(f.issuetype?.name), ...(f.labels ?? [])].filter(Boolean))];
  const comments = (f.comment?.comments ?? []).slice(-5).map(mapComment);
  const parent = f.parent;

  return {
    id: jiraId(ctx.customerId, issue.key),
    identifier: issue.key,
    number: issueNumber(issue.key),
    title: f.summary ?? "",
    url: `${ctx.baseUrl}/browse/${issue.key}`,
    description: adfToMarkdown(f.description),
    state: { name: state },
    cycle: ctx.sprintField ? sprintToCycle(f[ctx.sprintField], ctx.customerId) : null,
    assignee: f.assignee ? { id: f.assignee.accountId, email: f.assignee.emailAddress ?? null, displayName: f.assignee.displayName } : null,
    creator: f.creator ? { displayName: f.creator.displayName } : f.reporter ? { displayName: f.reporter.displayName } : null,
    branchName: issue.key.toLowerCase(),
    createdAt: f.created,
    updatedAt: f.updated,
    completedAt: state === "Done" || state === "Approved" ? (f.resolutiondate ?? f.statuscategorychangedate ?? null) : null,
    canceledAt: state === "Canceled" ? (f.resolutiondate ?? f.statuscategorychangedate ?? null) : null,
    comments: { nodes: comments },
    project: parent ? { id: jiraId(ctx.customerId, parent.key), name: parent.fields?.summary ?? parent.key, slugId: parent.key } : null,
    attachments: { nodes: (f.attachment ?? []).slice(0, 1).map((a: any) => ({ id: jiraId(ctx.customerId, `attachment:${a.id}`) })) },
    documents: { nodes: [] },
    dueDate: f.duedate ?? null,
    estimate: storyPoints(f, ctx),
    priorityLabel: priority?.label ?? "No priority",
    prioritySortOrder: priority?.order ?? 0,
    labels: { nodes: labels.map(portalLabel) },
    activitySummary: null,
  };
}
