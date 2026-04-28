// @ts-nocheck
import { LINEAR_GRAPHQL } from "../utils/headers.ts";
import { GET_COMPLETED_ISSUES_QUERY } from "./queries.ts";

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
    throw new Error(`Linear API error: ${json.errors[0]?.message}`);
  }

  return json.data;
}

export async function fetchCompletedIssues(projectIds: string[], after: string) {
  const results = await Promise.all(
    projectIds.map(async (projectId) => {
      const data = await linearFetch(GET_COMPLETED_ISSUES_QUERY, {
        projectId,
        after,
      });
      return {
        projectId,
        projectName: data.project?.name ?? projectId,
        issues: data.project?.issues?.nodes ?? [],
      };
    }),
  );

  return results;
}
