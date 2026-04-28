// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders, LINEAR_GRAPHQL } from "../utils/headers.ts";
import { PROJECTS_QUERY } from "./query.ts";

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
    .eq("linear_slug", slug)
    .maybeSingle();

  if (error) {
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

  return data.data;
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

    if (!slug) {
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

    const data = await fetchFromLinear(initiativeId);

    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
