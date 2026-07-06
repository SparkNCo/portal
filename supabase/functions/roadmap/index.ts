// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders, LINEAR_GRAPHQL } from "../utils/headers.ts";
import { PROJECTS_QUERY } from "./query.ts";

async function getCustomerBySlug(slug: string, schema: string) {
  console.log("[roadmap] getCustomerBySlug: querying customers", { schema, clientName: slug });

  const { data, error } = await supabase.schema(schema)
    .from("customers")
    .select(
      `
      linear_projects,
      linear_slug
    `,
    )
    .eq("clientName", slug)
    .maybeSingle();

  if (error) {
    console.error("[roadmap] getCustomerBySlug: supabase error", error.message);
    throw new Error("Customer not found");
  }

  if (!data) {
    console.error("[roadmap] getCustomerBySlug: no customer row for clientName", slug);
    throw new Error("Customer not found");
  }

  console.log("[roadmap] getCustomerBySlug: found customer", data);

  return data;
}

async function fetchFromLinear(initiativeId: string) {
  console.log("[roadmap] fetchFromLinear: requesting initiative", initiativeId);

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

  console.log("[roadmap] fetchFromLinear: response status", res.status);

  if (data.errors) {
    console.error("[roadmap] fetchFromLinear: Linear GraphQL errors", JSON.stringify(data.errors));
    throw new Error(`Linear API error: ${data.errors[0]?.message ?? "unknown"}`);
  }

  const projects = data.data?.initiative?.projects?.nodes ?? [];
  console.log(
    "[roadmap] fetchFromLinear: projects returned",
    projects.length,
    projects.map((p: any) => ({
      name: p.name,
      milestones: p.projectMilestones?.nodes?.length ?? 0,
    })),
  );

  if (!data.data?.initiative) {
    console.error("[roadmap] fetchFromLinear: no initiative found for id", initiativeId);
  }

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
    const schema = "portal";
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
    console.log("[roadmap] request received for slug", slug);

    // ✅ Fetch customer
    const customer = await getCustomerBySlug(slug, schema);

    if (!customer.linear_slug) {
      console.error("[roadmap] customer has no linear_slug configured", { slug });
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

    console.log("[roadmap] returning response for slug", slug);

    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[roadmap] request failed", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
