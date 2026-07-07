// @ts-nocheck
import { LINEAR_GRAPHQL } from "../utils/headers.ts";
import { GET_PROJECT_QUERY, GET_CYCLE_ISSUES_QUERY, GET_PROJECT_CYCLES_QUERY, GET_CYCLE_DETAILS_QUERY, GET_PROJECT_ISSUE_STATUSES_QUERY } from "./queries.ts";

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

// Linear defaults to a small page size when `first` isn't set, which silently
// truncated large projects' issue lists — that's what caused the active cycle
// (or its issues) to go undetected for those projects on some days. Paginate
// through every page so nothing is missed, same pattern as fetchProjectById.
export async function fetchProjectDetails(projectIds: string[]) {
  return Promise.all(projectIds.map(fetchOneProjectDetails));
}

async function fetchOneProjectDetails(projectId: string) {
  const nodes: any[] = [];
  let id = "";
  let name = "";
  let after: string | undefined;

  do {
    const data = await linearFetch(GET_PROJECT_QUERY, { projectId, after });
    const project = data.project;
    if (!project) return null;
    id = project.id;
    name = project.name;
    nodes.push(...(project.issues?.nodes ?? []));
    const pageInfo = project.issues?.pageInfo;
    after = pageInfo?.hasNextPage ? pageInfo.endCursor : undefined;
  } while (after);

  return { id, name, issues: { nodes } };
}

export async function fetchCycleIssues(cycleId: string) {
  const issues: any[] = [];
  let after: string | undefined;

  do {
    const data = await linearFetch(GET_CYCLE_ISSUES_QUERY, { cycleId, after });
    issues.push(...(data.cycle?.issues?.nodes ?? []));
    const pageInfo = data.cycle?.issues?.pageInfo;
    after = pageInfo?.hasNextPage ? pageInfo.endCursor : undefined;
  } while (after);

  return issues;
}

export async function fetchProjectById(projectId: string) {
  const issues: any[] = [];
  let name = "";
  let after: string | undefined;

  do {
    const page = await linearFetch(GET_PROJECT_ISSUE_STATUSES_QUERY, { projectId, after });
    const project = page.project;
    if (!project) return null;
    if (!name) name = project.name;
    issues.push(...(project.issues?.nodes ?? []));
    const pageInfo = project.issues?.pageInfo;
    after = pageInfo?.hasNextPage ? pageInfo.endCursor : undefined;
  } while (after);

  return { id: projectId, name, issues };
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
