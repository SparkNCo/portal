// @ts-nocheck
import { supabase } from "../client.ts";
import { redis } from "../lib/redis.ts";
import { corsHeaders, LINEAR_GRAPHQL } from "../utils/headers.ts";
import { PROJECTS_QUERY } from "./query.ts";
import { RoadmapResponseSchema } from "./zod.ts";

async function getCustomerBySlug(slug: string) {
  console.log("[getCustomerBySlug] Fetching customer for slug:", slug);

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
    console.error("[getCustomerBySlug] Supabase error:", error);
    throw new Error("Customer not found");
  }

  if (!data) {
    console.warn("[getCustomerBySlug] No customer found for slug:", slug);
    throw new Error("Customer not found");
  }

  console.log("[getCustomerBySlug] Customer found:", data);

  return data;
}

async function fetchFromLinear(initiativeId: string) {
  console.log(
    "[fetchFromLinear] Fetching from Linear with initiativeId:",
    initiativeId,
  );

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

  console.log("[fetchFromLinear] Response status:", res.status);

  const data = await res.json();
  console.log(
    "[fetchFromLinear] Raw response:",
    JSON.stringify(data).slice(0, 500),
  );

  const parsed = RoadmapResponseSchema.parse(data.data);

  console.log("[fetchFromLinear] Parsed response OK");

  return parsed;
}

Deno.serve(async (req) => {
  console.log("\n=== [REQUEST START] ===");
  console.log("[Request] Method:", req.method);
  console.log("[Request] URL:", req.url);

  if (req.method === "OPTIONS") {
    console.log("[CORS] Preflight request");
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const { searchParams } = new URL(req.url);

    const rawSlug = searchParams.get("slug");
    const slug = rawSlug ? decodeURIComponent(rawSlug) : null;

    console.log("[Params] rawSlug:", rawSlug);
    console.log("[Params] decoded slug:", slug);

    if (!slug) {
      console.warn("[Validation] Missing slug");
      return new Response(JSON.stringify({ error: "Missing slug" }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // ✅ Fetch customer
    const customer = await getCustomerBySlug(slug);

    console.log(
      "[Customer] linear_initiative_id:",
      customer.linear_initiative_id,
    );
    console.log("[Customer] linear_slug:", customer.linear_slug);

    if (!customer.linear_initiative_id) {
      console.warn("[Validation] No Linear initiative configured");
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

    console.log("[Cache] Key:", cacheKey);

    const cached = await redis.get(cacheKey);

    if (cached) {
      console.log("[Cache] HIT");

      // Background refresh
      fetchFromLinear(initiativeId)
        .then((freshData) => {
          console.log("[Cache] Refreshing cache in background");
          return redis.set(cacheKey, JSON.stringify(freshData), { ex: 300 });
        })
        .catch((err) => {
          console.error("[Cache] Background refresh failed:", err);
        });

      return new Response(cached, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    console.log("[Cache] MISS");

    const data = await fetchFromLinear(initiativeId);

    console.log("[Cache] Storing fresh data");

    await redis.set(cacheKey, JSON.stringify(data), { ex: 300 });

    console.log("=== [REQUEST SUCCESS] ===\n");

    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[ERROR] Full error object:", error);
    console.error("[ERROR] Message:", error.message);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
