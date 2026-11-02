// @ts-nocheck
// Jira → the roadmap's shapes (the ones the Linear adapter returns). No
// Deno imports (unit-tested).
//
// Rows (Linear projects) are Epics. An epic's status picks its group: to do
// → "Backlog" (Upcoming), done → "In Production" (Completed), anything in
// progress stays active. Milestones are the Jira versions its tickets are
// in; tickets with no version go in a "No version" milestone so they still
// light up their sprints. Columns (cycles) are the board's sprints.
import { jiraId } from "../ids.ts";
import { mapIssue, sprintToCycle, type JiraMapContext } from "./map.ts";

export type RoadmapGroup = "active" | "completed" | "upcoming";

// Jira's status category ids, as JQL takes them (names are localised).
export const GROUP_CATEGORY_ID: Record<RoadmapGroup, number> = { upcoming: 2, active: 4, completed: 3 };

const CATEGORY_COLOR: Record<string, string> = { new: "#9ca3af", indeterminate: "#fb923c", done: "#4ade80" };

// The status name the timeline groups by ("In Production" / "Backlog" are
// the two it sets apart).
export function epicStatusName(status: any): string {
  const category = status?.statusCategory?.key;
  if (category === "done") return "In Production";
  if (category === "new") return "Backlog";
  const name = status?.name ?? "In Progress";
  return name === "Backlog" || name === "In Production" ? "In Progress" : name;
}

export const NO_VERSION = "noversion:";

export function noVersionMilestoneId(customerId: string, epicKey: string): string {
  return jiraId(customerId, `${NO_VERSION}${epicKey}`);
}

// The milestone a ticket belongs to on the roadmap: its first version,
// within its epic — `version:{id}:{epic}`, because a Jira version spans the
// whole project and clicking it inside one epic must list only that epic's
// tickets.
export function milestoneIdOf(issue: any, customerId: string): string {
  const version = issue?.fields?.fixVersions?.[0];
  const epicKey = issue?.fields?.parent?.key ?? "";
  return version ? jiraId(customerId, `version:${version.id}:${epicKey}`) : noVersionMilestoneId(customerId, epicKey);
}

// done: released, or every ticket done · overdue: release date passed ·
// in-progress: some ticket started or done · unstarted: otherwise.
export function milestoneStatus(version: any, issues: any[], today: string): string {
  const categories = issues.map((i) => i?.fields?.status?.statusCategory?.key);
  if (version?.released || (issues.length > 0 && categories.every((c) => c === "done"))) return "done";
  if (version?.releaseDate && version.releaseDate < today) return "overdue";
  if (categories.some((c) => c === "indeterminate" || c === "done")) return "in-progress";
  return "unstarted";
}

// One roadmap row: an epic, its milestones and the sprints of their tickets.
export function roadmapProject(epic: any, children: any[], versionsById: Map<string, any>, ctx: JiraMapContext, today: string) {
  const groups = new Map<string, any[]>();
  for (const issue of children) {
    const id = milestoneIdOf(issue, ctx.customerId);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(issue);
  }

  const milestones = [...groups.entries()].map(([id, issues]) => {
    const versionId = issues[0]?.fields?.fixVersions?.[0]?.id;
    const version = versionId ? versionsById.get(String(versionId)) : null;
    return {
      id,
      name: version?.name ?? (versionId ? issues[0].fields.fixVersions[0].name : "No version"),
      status: milestoneStatus(version, issues, today),
      targetDate: version?.releaseDate ?? null,
      issues: {
        nodes: issues.map((issue) => ({
          cycle: ctx.sprintField ? (sprintToCycle(issue.fields?.[ctx.sprintField], ctx.customerId) ?? null) : null,
        })),
      },
    };
  });
  // Versions by release date; "No version" last.
  milestones.sort((a, b) => {
    if (a.name === "No version") return 1;
    if (b.name === "No version") return -1;
    return String(a.targetDate ?? "9999").localeCompare(String(b.targetDate ?? "9999"));
  });

  const category = epic.fields?.status?.statusCategory?.key;
  return {
    id: jiraId(ctx.customerId, epic.key),
    name: epic.fields?.summary ?? epic.key,
    targetDate: epic.fields?.duedate ?? null,
    projectMilestones: { nodes: milestones },
    status: { name: epicStatusName(epic.fields?.status), color: CATEGORY_COLOR[category] ?? CATEGORY_COLOR.new },
  };
}

// A ticket in the roadmap's issue panel (same shape as the Linear queries').
export function roadmapIssue(issue: any, ctx: JiraMapContext) {
  return { ...mapIssue(issue, ctx), projectMilestone: { id: milestoneIdOf(issue, ctx.customerId) } };
}

// A Jira sprint as a timeline column. `number` stays null so the column is
// labelled with the sprint's name.
export function roadmapCycle(sprint: any, customerId: string) {
  return {
    id: jiraId(customerId, `sprint:${sprint.id}`),
    number: null,
    name: sprint.name ?? null,
    startsAt: sprint.startDate ?? null,
    endsAt: sprint.endDate ?? sprint.completeDate ?? null,
    isActive: sprint.state === "active",
    isPast: sprint.state === "closed",
    isFuture: sprint.state === "future",
  };
}

// The JQL that narrows to a roadmap milestone (`version:{id}:{epic}`,
// `version:{id}` or `noversion:{epic}`).
export function milestoneJql(nativeMilestoneId: string): string {
  if (nativeMilestoneId.startsWith(NO_VERSION)) {
    return `parent = "${nativeMilestoneId.slice(NO_VERSION.length)}" AND fixVersion is EMPTY`;
  }
  const [, versionId, epicKey] = nativeMilestoneId.split(":");
  const version = `fixVersion = ${Number(versionId)}`;
  return epicKey ? `${version} AND parent = "${epicKey}"` : version;
}
