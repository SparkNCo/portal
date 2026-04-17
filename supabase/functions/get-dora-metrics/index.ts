// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { supabase } from "../client.ts";
import { parseRepo, fetchDeployments } from "./deployFreq.ts";

async function getCustomerByUrl(url: string) {
  const { data, error } = await supabase
    .from("customers")
    .select("customer_id, project_url")
    .eq("url", url)
    .maybeSingle();

  if (error) throw new Error(`Supabase error: ${error.message}`);
  if (!data) throw new Error(`No customer found for url: ${url}`);
  return data;
}

async function saveMetrics(customerId: string, benchmark: Record<string, any>) {
  const { error } = await supabase
    .from("metrics")
    .upsert(
      { customer_id: customerId, benchmark },
      { onConflict: "customer_id" },
    );

  if (error) throw new Error(`Failed to save metrics: ${error.message}`);
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
    const token = Deno.env.get("GHPERSONALTOKEN");
    if (!token) throw new Error("Missing GHPERSONALTOKEN env var");

    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    const limit = Math.min(Number.parseInt(searchParams.get("limit") ?? "50", 10), 200);

    if (!url) {
      return new Response(JSON.stringify({ error: "Missing url param" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const customer = await getCustomerByUrl(url);
    const projectUrls: string[] = customer.project_url ?? [];

    if (!projectUrls.length) {
      return new Response(
        JSON.stringify({ error: "Customer has no project_url entries" }),
        { status: 404, headers: corsHeaders },
      );
    }

    // Fetch deploy frequency for every repo in parallel
    const repoResults = await Promise.all(
      projectUrls.map(async (repoUrl) => {
        const repo = parseRepo(repoUrl);
        const deployments = await fetchDeployments(repo, token, limit);
        return { repo, total_deployments: deployments.length, deployments };
      }),
    );

    const benchmark = {
      fetched_at: new Date().toISOString(),
      repos: repoResults,
    };

    await saveMetrics(customer.customer_id, benchmark);

    return new Response(
      JSON.stringify({ customer_id: customer.customer_id, benchmark }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
