// @ts-nocheck
import { LINEAR_GRAPHQL } from "../utils/headers.ts";

export async function linearRequest(query: string, variables: Record<string, any> = {}) {
  const res = await fetch(LINEAR_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: Deno.env.get("LINEAR_API_KEY")!,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

export const GET_PROJECT_TEAM_QUERY = `
  query GetProjectTeam($id: String!) {
    project(id: $id) {
      teams(first: 1) { nodes { id } }
    }
  }
`;

export const GET_TEAM_LABELS_QUERY = `
  query GetTeamLabels($teamId: String!) {
    team(id: $teamId) {
      labels {
        nodes { id name color }
      }
    }
  }
`;

export const GET_INITIATIVE_PROJECTS_QUERY = `
  query GetInitiativeProjects($initiativeId: String!) {
    initiative(id: $initiativeId) {
      projects(first: 50) {
        nodes { id name status { type } }
      }
    }
  }
`;

const CLOSED_PROJECT_STATUS_TYPES = new Set(["completed", "canceled"]);

export function isClosedProject(project: { status?: { type?: string | null } | null } | null | undefined): boolean {
  return CLOSED_PROJECT_STATUS_TYPES.has(String(project?.status?.type ?? "").toLowerCase());
}

const PROJECT_STATUS_QUERY = `
  query ProjectStatus($id: String!) {
    project(id: $id) { id name status { type name } }
  }
`;

export async function closedProjectError(projectId: string): Promise<string | null> {
  const data = await linearRequest(PROJECT_STATUS_QUERY, { id: projectId });
  const project = data?.project;
  if (!project || !isClosedProject(project)) return null;
  return `"${project.name}" is ${project.status?.name ?? "closed"} — new tickets can't be added to a completed or cancelled project.`;
}
