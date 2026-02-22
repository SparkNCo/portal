// @ts-nocheck
import { corsHeaders, LINEAR_GRAPHQL } from "../utils/headers.ts";
import { ISSUES_QUERY } from "./query.ts";
import {
  GetIssuesQuerySchema,
  IssuesResponseSchema,
} from "./zod.ts";

async function fetchIssues(projectIds: string[]) {
  const filter = {
    project: { id: { in: projectIds } },
    state: { name: { in: null } },
  };

  const res = await fetch(LINEAR_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: Deno.env.get("LINEAR_API_KEY")!,
    },
    body: JSON.stringify({
      query: ISSUES_QUERY,
      variables: { filter },
    }),
  });

  const json = await res.json();

  if (json.errors) {
    throw new Error(JSON.stringify(json.errors));
  }

  const parsed = IssuesResponseSchema.safeParse(json);

  if (!parsed.success) {
    console.error("Invalid Linear response", parsed.error.format());
    throw new Error("Invalid response from Linear API");
  }

  return parsed.data.data.issues.nodes;
}

Deno.serve(async (req) => {
  // ✅ CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const { searchParams } = new URL(req.url);
    const parseResult = GetIssuesQuerySchema.safeParse({
      projectIds: searchParams.get("projectIds"),
    });

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid query params",
          details: parseResult.error.flatten(),
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const { projectIds } = parseResult.data;
    const projectIdsArray = projectIds.split("--");

    const issues = await fetchIssues(projectIdsArray);

    return new Response(JSON.stringify(issues), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[Linear API Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
