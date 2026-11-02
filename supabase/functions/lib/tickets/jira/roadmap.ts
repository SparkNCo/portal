// @ts-nocheck
// Jira adapter — roadmap. Same operations and shapes as
// lib/tickets/linear/roadmap.ts; the mapping is in roadmapMap.ts.
import { TicketError, type TicketCustomer } from "../errors.ts";
import { jiraId, parseTicketId } from "../ids.ts";
import type { RoadmapAdapter } from "../linear/roadmap.ts";
import { jiraSession } from "./client.ts";
import { GROUP_CATEGORY_ID, milestoneJql, roadmapCycle, roadmapIssue, roadmapProject, type RoadmapGroup } from "./roadmapMap.ts";

const PROJECTS_PER_PAGE = 10;
const ISSUES_PER_PAGE = 25;
const EMPTY_PAGE = { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };

function nativeId(id: string): string {
  const parsed = parseTicketId(id);
  if (parsed.system !== "jira") throw new TicketError("That id doesn't belong to this customer's Jira.", 400);
  return parsed.nativeId;
}

function asPage(nodes: any[], nextPageToken: string | null) {
  return { nodes, pageInfo: { hasNextPage: !!nextPageToken, endCursor: nextPageToken } };
}

// `options.token` skips the Vault lookup (local scripts only).
export function jiraRoadmap(customer: TicketCustomer, options: { token?: string } = {}): RoadmapAdapter {
  const jira = jiraSession(customer, options);
  const inProject = () => `project = "${jira.projectKey}"`;

  // One page of tickets for the roadmap's issue panel.
  async function issuePage(jql: string, after: string | null) {
    const [page, ctx] = await Promise.all([
      jira.searchPage(`${jql} ORDER BY created ASC`, await jira.issueFields(), ISSUES_PER_PAGE, after),
      jira.mapContext(),
    ]);
    return asPage(page.issues.map((issue: any) => roadmapIssue(issue, ctx)), page.nextPageToken);
  }

  return {
    // Epics of one group (by status category), with their milestones.
    async projects(group: RoadmapGroup, after: string | null) {
      const initiative = { id: jiraId(jira.customerId, jira.projectKey), projects: EMPTY_PAGE };
      const epicType = await jira.issueTypeFor("epic");
      if (!epicType) return { initiative };

      const page = await jira.searchPage(
        `${inProject()} AND issuetype = ${epicType.id} AND statusCategory = ${GROUP_CATEGORY_ID[group]} ORDER BY created ASC`,
        ["summary", "status", "duedate"],
        PROJECTS_PER_PAGE,
        after,
      );
      if (page.issues.length === 0) return { initiative };

      const ctx = await jira.mapContext();
      const keys = page.issues.map((e: any) => `"${e.key}"`).join(", ");
      const [children, versions] = await Promise.all([
        jira.searchAll(`parent in (${keys}) ORDER BY created ASC`, ["parent", "status", "fixVersions", ...(ctx.sprintField ? [ctx.sprintField] : [])], 500),
        jira.request("GET", `/rest/api/3/project/${encodeURIComponent(jira.projectKey)}/versions`),
      ]);
      const versionsById = new Map((versions ?? []).map((v: any) => [String(v.id), v]));
      const today = new Date().toISOString().slice(0, 10);

      const nodes = page.issues.map((epic: any) =>
        roadmapProject(epic, children.filter((c: any) => c.fields?.parent?.key === epic.key), versionsById, ctx, today),
      );
      return { initiative: { ...initiative, projects: asPage(nodes, page.nextPageToken) } };
    },

    // Every sprint of the project's board, as timeline columns.
    async cycles(_projectNodes: any[]) {
      const board = await jira.boardId();
      if (!board) return EMPTY_PAGE;

      const sprints: any[] = [];
      let startAt = 0;
      try {
        for (;;) {
          const page = await jira.request("GET", `/rest/agile/1.0/board/${board}/sprint?startAt=${startAt}&maxResults=50`);
          sprints.push(...(page?.values ?? []));
          if (page?.isLast !== false || !page?.values?.length) break;
          startAt += page.values.length;
        }
      } catch (err) {
        // Boards without sprints (Jira's "simple" boards with Sprints off) answer 400.
        if (err instanceof TicketError && err.status === 400) return EMPTY_PAGE;
        throw err;
      }
      return asPage(sprints.map((s) => roadmapCycle(s, jira.customerId)), null);
    },

    async cycleIssues(cycleId: string, after: string | null, projectId: string | null, milestoneId: string | null) {
      const sprint = Number(nativeId(cycleId).replace(/^sprint:/, ""));
      const clauses = [inProject(), `sprint = ${sprint}`];
      if (projectId) clauses.push(`parent = "${nativeId(projectId)}"`);
      if (milestoneId) clauses.push(milestoneJql(nativeId(milestoneId)));
      return await issuePage(clauses.join(" AND "), after);
    },

    async milestoneIssues(milestoneId: string, after: string | null) {
      return await issuePage(`${inProject()} AND ${milestoneJql(nativeId(milestoneId))}`, after);
    },

    async projectIssues(projectId: string, after: string | null) {
      return await issuePage(`${inProject()} AND parent = "${nativeId(projectId)}"`, after);
    },
  };
}
