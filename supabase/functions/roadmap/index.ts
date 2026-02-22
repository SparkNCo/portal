// @ts-nocheck
import { redis } from "../lib/redis.ts";
import { corsHeaders, LINEAR_GRAPHQL } from "../utils/headers.ts";
import { PROJECTS_QUERY } from "./query.ts";
import { GetRoadMapDataQuerySchema, RoadmapResponseSchema } from "./zod.ts";

async function fetchFromLinear(initiativeId: string) {
  const res = await fetch(LINEAR_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: Deno.env.get("LINEAR_API_KEY")!,
    },
    body: JSON.stringify({
      query: PROJECTS_QUERY,
      variables: { initiativeId },
    }),
  });

  const data = await res.json();
  const parsed = RoadmapResponseSchema.parse(data.data);
  return parsed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const { searchParams } = new URL(req.url);
    const parsedQuery = GetRoadMapDataQuerySchema.safeParse({
      initiativeId: searchParams.get("initiativeId"),
    });

    if (!parsedQuery.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid query params",
          details: parsedQuery.error.flatten(),
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

    const { initiativeId } = parsedQuery.data;
    const cacheKey = `roadmap:${initiativeId}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      fetchFromLinear(initiativeId)
        .then((freshData) =>
          redis.set(cacheKey, JSON.stringify(freshData), { ex: 300 }),
        )
        .catch(console.error);

      return new Response(JSON.stringify(cached || cached), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    const data = await fetchFromLinear(initiativeId);

    await redis.set(cacheKey, JSON.stringify(data), { ex: 300 });

    return new Response(JSON.stringify(data), {
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
