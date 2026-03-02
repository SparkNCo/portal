// @ts-nocheck
import { supabase } from "../client.ts";
import { redis } from "../lib/redis.ts";
import { corsHeaders, LINEAR_GRAPHQL } from "../utils/headers.ts";
import { PROJECTS_QUERY } from "./query.ts";
import { RoadmapResponseSchema } from "./zod.ts";

async function getCustomerBySlug(slug: string) {
  const { data, error } = await supabase
    .from("customers")
    .select(
      `
      linear_projects,
      linear_initiative_id,
      linear_slug,
      proposal_id,
      stripe_customer_id
    `,
    )
    .eq("linear_name", slug)
    .maybeSingle();

  if (error) {
    console.error("Supabase error:", error);
    throw new Error("Customer not found");
  }

  if (!data) {
    throw new Error("Customer not found");
  }

  return data;
}

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

    const rawSlug = searchParams.get("slug");
    const slug = rawSlug ? decodeURIComponent(rawSlug) : null;
    console.log("slug:", slug);

    if (!slug) {
      return new Response(JSON.stringify({ error: "Missing slug" }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // ✅ Fetch full customer record
    const customer = await getCustomerBySlug(slug);

    if (!customer.linear_initiative_id) {
      return new Response(
        JSON.stringify({ error: "No Linear initiative configured" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const initiativeId = customer.linear_slug;
    const cacheKey = `roadmap:${initiativeId}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      fetchFromLinear(initiativeId)
        .then((freshData) =>
          redis.set(cacheKey, JSON.stringify(freshData), { ex: 300 }),
        )
        .catch(console.error);

      return new Response(cached, {
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
