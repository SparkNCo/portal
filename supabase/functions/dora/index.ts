// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { supabase } from "../client.ts";
import { parseRepo } from "./github.ts";
import { handleCFR } from "./cfr.ts";
import { handleLatest } from "./latest.ts";
import { handleIssueResolutionTime } from "./mttr.ts";
import { handleLeadTime } from "./leadTime.ts";
import { handleTimelines } from "./timelines.ts";
import { handleDeployFreq } from "./deployFreq.ts";

const handlers: Record<string, (repo: string, token: string, limit: number) => Promise<unknown>> = {
  cfr: handleCFR,
  latest: handleLatest,
  mttr: handleIssueResolutionTime,
  leadTime: handleLeadTime,
  timelines: handleTimelines,
  deployFreq: handleDeployFreq,
};

async function handleAll(repo: string, token: string, limit: number) {
  const [cfr, leadTime, mttr, deployFreq] = await Promise.all([
    handleCFR(repo, token, limit),
    handleLeadTime(repo, token, limit),
    handleIssueResolutionTime(repo, token, limit),
    handleDeployFreq(repo, token, limit),
  ]);

  return {
    repo,
    averages: {
      change_failure_rate: { value: cfr.change_failure_rate, unit: "%" },
      lead_time_for_changes: { value: leadTime.avg_lead_hours, unit: "hours" },
      mean_time_to_restore: { value: mttr.average_resolution_hours, unit: "hours" },
      deploy_frequency: { value: deployFreq.total_deployments, unit: "deployments" },
    },
    details: { cfr, leadTime, mttr, deployFreq },
  };
}

async function saveDoraMetrics(customerId: string, result: Awaited<ReturnType<typeof handleAll>>) {
  const { error } = await supabase.from("dorametrics").upsert(
    {
      customer_id: customerId,
      averages: result.averages,
      cfr_details: result.details.cfr,
      lead_time_details: result.details.leadTime,
      mttr_details: result.details.mttr,
      deploy_freq_details: result.details.deployFreq,
    },
    { onConflict: "customer_id" },
  );

  if (error) throw new Error(`Failed to save dora metrics: ${error.message}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const token = Deno.env.get("GHPERSONALTOKEN");
    if (!token) throw new Error("Missing GHPERSONALTOKEN env var");

    const body = await req.json();
    const { method, url: repoUrl, customer_id, limit: rawLimit } = body;

    if (!repoUrl) {
      return new Response(JSON.stringify({ error: "Missing url param" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!customer_id) {
      return new Response(JSON.stringify({ error: "Missing customer_id param" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!method) {
      return new Response(JSON.stringify({ error: "Missing method param" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const limit = Math.min(Number.parseInt(rawLimit ?? "100", 10), 500);
    const repo = parseRepo(repoUrl);

    if (method === "all") {
      const result = await handleAll(repo, token, limit);
      await saveDoraMetrics(customer_id, result);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const handler = handlers[method];
    if (!handler) {
      return new Response(
        JSON.stringify({
          error: `Unknown method: "${method}". Available: all, ${Object.keys(handlers).join(", ")}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await handler(repo, token, limit);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
