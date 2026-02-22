// @ts-nocheck
import { supabase } from "../client.ts";
import { LINEAR_GRAPHQL } from "../utils/headers.ts";

export async function linearFetch(query: string, variables = {}) {
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

export function extractProjectAndInitiativeIds(userData: any) {
  const projectIds = new Set<string>();
  const initiativeIds = new Set<string>();

  const teams = userData?.user?.teams?.nodes || [];

  for (const team of teams) {
    const projects = team?.projects?.nodes || [];

    for (const project of projects) {
      if (project?.id) {
        projectIds.add(project.id);
      }
      const initiatives = project?.initiatives?.nodes || [];
      for (const initiative of initiatives) {
        if (initiative?.id) {
          initiativeIds.add(initiative.id);
        }
      }
    }
  }

  return {
    projectIds: Array.from(projectIds),
    initiativeIds: Array.from(initiativeIds),
  };
}

export async function saveUserProjects(
  linearUserId: string,
  projectIds: string[],
) {
  const { data, error } = await supabase
    .from("users")
    .update({
      project_ids: projectIds,
    })
    .eq("linear_user_id", linearUserId);

  if (error) {
    throw error;
  }

  return data;
}

export async function saveUserProjectsByEmail(
  email: string,
  projectIds: string[],
  initiativeIds: string[],
) {
  const { data, error } = await supabase
    .from("users")
    .update({
      project_ids: projectIds,
      initiative_ids: initiativeIds,
    })
    .eq("email", email);

  if (error) {
    throw error;
  }

  return data;
}
