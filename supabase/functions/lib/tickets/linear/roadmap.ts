// @ts-nocheck
// Linear adapter — roadmap. The code roadmap/index.ts used to run inline,
// unchanged in behaviour. Shapes (which the timeline is built on):
//   projects(group, after) → { initiative: { id, projects: { pageInfo, nodes } } }
//   cycles(projectNodes)   → { nodes, pageInfo }
//   *Issues(...)           → { nodes, pageInfo }
import { TicketError, type TicketCustomer } from "../errors.ts";
import { linearRequest } from "./client.ts";
import {
  CYCLE_ISSUES_QUERY,
  FIRST_PROJECT_QUERY,
  MILESTONE_ISSUES_QUERY,
  PROJECT_ISSUES_QUERY,
  PROJECT_TEAM_QUERY,
  PROJECTS_QUERY,
  TEAM_CYCLES_QUERY,
} from "./roadmapQueries.ts";

export type ProjectGroup = "active" | "completed" | "upcoming";

const EMPTY_PAGE = { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };

// Linear project status names that get their own collapsed divider in the
// timeline. Each group is fetched as a separate call so it has its own
// 10-per-page budget instead of sharing one with active projects.
const COMPLETED_STATUS = "In Production";
const UPCOMING_STATUS = "Backlog";

function projectFilterForGroup(group: ProjectGroup) {
  if (group === "completed") return { status: { name: { eq: COMPLETED_STATUS } } };
  if (group === "upcoming") return { status: { name: { eq: UPCOMING_STATUS } } };
  return { status: { name: { nin: [COMPLETED_STATUS, UPCOMING_STATUS] } } };
}

// `customer` is null for requests that only carry a cycle/project/milestone id.
export function linearRoadmap(customer: TicketCustomer | null) {
  function initiativeId(): string {
    if (!customer?.linear_slug) throw new TicketError("No Linear initiative configured", 400);
    return customer.linear_slug;
  }

  return {
    async projects(group: ProjectGroup, after: string | null) {
      const id = initiativeId();
      const data = await linearRequest(PROJECTS_QUERY, { initiativeId: id, after, filter: projectFilterForGroup(group) });
      if (!data?.initiative) console.error("[roadmap] no initiative found for id", id);
      return data;
    },

    // Cycles belong to a team, not a project — resolve the first project's
    // team, then fetch that team's full cycle list. Every project in an
    // initiative typically shares one team. If the active group is empty,
    // any project of the initiative is used instead.
    async cycles(projectNodes: any[]) {
      let firstProjectId = projectNodes[0]?.id;
      if (!firstProjectId) {
        const anyProject = await linearRequest(FIRST_PROJECT_QUERY, { initiativeId: initiativeId() });
        firstProjectId = anyProject?.initiative?.projects?.nodes?.[0]?.id;
      }
      if (!firstProjectId) return EMPTY_PAGE;

      const teamData = await linearRequest(PROJECT_TEAM_QUERY, { projectId: firstProjectId });
      const teamId = teamData?.project?.teams?.nodes?.[0]?.id;
      if (!teamId) {
        console.error("[roadmap] no team found for project", firstProjectId);
        return EMPTY_PAGE;
      }

      const cyclesData = await linearRequest(TEAM_CYCLES_QUERY, { teamId });
      return cyclesData?.team?.cycles ?? EMPTY_PAGE;
    },

    // A cycle clicked: its issues, optionally narrowed to a project and/or milestone.
    async cycleIssues(cycleId: string, after: string | null, projectId: string | null, milestoneId: string | null) {
      const filter: Record<string, unknown> = {};
      if (projectId) filter.project = { id: { eq: projectId } };
      if (milestoneId) filter.projectMilestone = { id: { eq: milestoneId } };
      const data = await linearRequest(CYCLE_ISSUES_QUERY, { cycleId, after, filter: Object.keys(filter).length ? filter : null });
      return data?.cycle?.issues ?? EMPTY_PAGE;
    },

    // A milestone clicked (no cycle): every issue in it.
    async milestoneIssues(milestoneId: string, after: string | null) {
      const data = await linearRequest(MILESTONE_ISSUES_QUERY, { milestoneId, after });
      return data?.projectMilestone?.issues ?? EMPTY_PAGE;
    },

    // A project header clicked (no cycle/milestone): every issue in the project.
    async projectIssues(projectId: string, after: string | null) {
      const data = await linearRequest(PROJECT_ISSUES_QUERY, { projectId, after });
      return data?.project?.issues ?? EMPTY_PAGE;
    },
  };
}

export type RoadmapAdapter = ReturnType<typeof linearRoadmap>;
