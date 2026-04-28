// @ts-nocheck
import { LINEAR_GRAPHQL } from "../utils/headers.ts";
import { GET_PROJECT_QUERY, GET_CYCLE_ISSUES_QUERY, GET_PROJECT_CYCLES_QUERY, GET_CYCLE_DETAILS_QUERY } from "./queries.ts";

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
    throw new Error(`Linear API error: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

export async function fetchProjectDetails(projectIds: string[]) {
  return Promise.all(
    projectIds.map(async (projectId) => {
      const data = await linearFetch(GET_PROJECT_QUERY, { projectId });
      return data.project;
    }),
  );
}

export async function fetchCycleIssues(cycleId: string) {
  const data = await linearFetch(GET_CYCLE_ISSUES_QUERY, { cycleId });
  return data.cycle?.issues?.nodes ?? [];
}

export async function fetchCycleByNumber(projectId: string, cycleNumber: number) {
  const data = await linearFetch(GET_PROJECT_CYCLES_QUERY, { projectId });
  const project = data.project;

  const cycleIds = new Map<number, string>();
  for (const issue of project?.issues?.nodes ?? []) {
    if (issue.cycle?.id && !cycleIds.has(issue.cycle.number)) {
      cycleIds.set(issue.cycle.number, issue.cycle.id);
    }
  }

  const cycleId = cycleIds.get(cycleNumber);
  if (!cycleId) return null;

  const detailsData = await linearFetch(GET_CYCLE_DETAILS_QUERY, { cycleId });
  return { project, cycle: detailsData.cycle };
}
