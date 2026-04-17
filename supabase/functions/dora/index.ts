// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { parseRepo } from "./github.ts";
import { handleCFR } from "./cfr.ts";
import { handleLatest } from "./latest.ts";
import { handleIssueResolutionTime } from "./mttr.ts";
import { handleLeadTime } from "./leadTime.ts";
import { handleTimelines } from "./timelines.ts";

const handlers: Record<string, (repo: string, token: string, limit: number) => Promise<unknown>> = {
  cfr: handleCFR,
  latest: handleLatest,
  mttr: handleIssueResolutionTime,
  leadTime: handleLeadTime,
  timelines: handleTimelines,
};

async function handleAll(repo: string, token: string, limit: number) {
  const [cfr, leadTime, mttr, latest] = await Promise.all([
    handleCFR(repo, token, limit),
    handleLeadTime(repo, token, limit),
    handleIssueResolutionTime(repo, token, limit),
    handleLatest(repo, token, limit),
  ]);

  return {
    repo,
    averages: {
      change_failure_rate: { value: cfr.change_failure_rate, unit: "%" },
      lead_time_for_changes: { value: leadTime.avg_lead_hours, unit: "hours" },
      mean_time_to_restore: { value: mttr.average_resolution_hours, unit: "hours" },
    },
    details: { cfr, leadTime, mttr, latest },
  };
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
    const repoUrl = Deno.env.get("REPO_URL");

    if (!token || !repoUrl) {
      throw new Error("Missing GHPERSONALTOKEN or REPO_URL env vars");
    }

    const { searchParams } = new URL(req.url);
    const method = searchParams.get("method") ?? "";
    const limit = Math.min(Number.parseInt(searchParams.get("limit") ?? "100", 10), 500);
    const repo = parseRepo(repoUrl);

    if (method === "all") {
      const result = await handleAll(repo, token, limit);
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
