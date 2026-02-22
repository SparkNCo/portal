// @ts-nocheck

import { LINEAR_GRAPHQL } from "../utils/headers.ts";


/**
 * Generic Linear fetch wrapper
 */
async function linearFetch(query: string, variables?: Record<string, any>) {
  const res = await fetch(LINEAR_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",

      // Recommended format
      Authorization: `${Deno.env.get("LINEAR_API_KEY")}`,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(JSON.stringify(json));
  }

  return json.data;
}

/**
 * Fetch user + initiatives by email
 */
export async function fetchUserFromLinear(
  email: string,
  query: string,
) {
  return await linearFetch(query, { email });
}

/**
 * Fetch all initiatives in org scope
 */
export async function fetchAllInitiatives(query: string) {
  return await linearFetch(query);
}
