// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { supabase } from "../client.ts";
import { fetchCompletedIssues } from "./linear.ts";
import { buildDoraMetrics } from "./metrics.ts";

async function getCustomerBySlug(slug: string) {
  console.log(`Fetching customer by slug: ${slug}`);

  const { data, error } = await supabase
    .from("users")
    .select("linear_projects, linear_slug")
    .eq("linear_slug", slug)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Customer not found");
  }

  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    const days = Math.min(
      Math.max(parseInt(searchParams.get("days") ?? "30", 10), 7),
      90,
    );

    if (!slug) {
      return new Response(JSON.stringify({ error: "Missing slug" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const customer = await getCustomerBySlug(slug);
    const linearProjects: string[] = customer.linear_projects ?? [];

    if (!linearProjects.length) {
      return new Response(
        JSON.stringify({ error: "No Linear projects linked to this customer" }),
        { status: 404, headers: corsHeaders },
      );
    }

    const after = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();

    const projects = await fetchCompletedIssues(linearProjects, after);
    const metrics = buildDoraMetrics(projects, days);

    return new Response(JSON.stringify(metrics), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
