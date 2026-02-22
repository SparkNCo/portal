// @ts-nocheck
import { LINEAR_GRAPHQL } from "../utils/headers.ts";
import { PROJECTS_BY_IDS_QUERY } from "./query.ts";

async function linearFetch(query: string, variables = {}) {
  const res = await fetch(LINEAR_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: Deno.env.get("LINEAR_API_KEY"),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify(json));
  }

  return json.data;
}

export async function fetchRoadmapByProjects(
  email: string,
  projectIds: string[],
) {
  if (!projectIds?.length) {
    throw new Error("projectIds are required");
  }
  console.log("projectIds", projectIds);

  // 1️⃣ Fetch all projects at once
  const data = await linearFetch(PROJECTS_BY_IDS_QUERY, {
    projectIds,
  });

  const projects = (data?.nodes || []).filter(Boolean);

  return {
    email,
    count: projects.length,
    data,
  };
}
