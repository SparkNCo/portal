// @ts-nocheck
import { LINEAR_GRAPHQL } from "../utils/headers.ts";
import {
  PROJECTS_LIGHT_QUERY,
  ISSUES_BY_MILESTONE_QUERY,
} from "./queries.ts";

async function linearFetch(query: string, variables: any) {
  const res = await fetch(LINEAR_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: Deno.env.get("LINEAR_API_KEY")!,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (json.errors) {
    throw new Error("Linear API error");
  }

  return json.data;
}

export async function fetchProjectsAndMilestones(initiativeId: string) {
  const data = await linearFetch(PROJECTS_LIGHT_QUERY, { initiativeId });
  return data.initiative;
}

export async function fetchIssuesForMilestones(milestoneIds: string[]) {
  return Promise.all(
    milestoneIds.map(async (milestoneId) => {
      const data = await linearFetch(ISSUES_BY_MILESTONE_QUERY, { milestoneId });
      return { milestoneId, issues: data.issues.nodes };
    }),
  );
}

export function mergeData(initiative: any, issuesByMilestone: any[]) {
  const map = new Map(issuesByMilestone.map((item) => [item.milestoneId, item.issues]));

  for (const project of initiative.projects.nodes) {
    for (const milestone of project.projectMilestones.nodes) {
      milestone.issues = map.get(milestone.id) || [];
    }
  }

  return initiative;
}
