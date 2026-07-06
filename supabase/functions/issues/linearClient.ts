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
        nodes { id name }
      }
    }
  }
`;
