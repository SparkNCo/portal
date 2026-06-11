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
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  console.log("🚀 handleAll started", { repo, limit, since: since.toISOString() });

  const [cfr, leadTime, mttr, deployFreq] = await Promise.all([
    handleCFR(repo, token, limit).then(r => { console.log("✅ CFR done"); return r; }).catch(e => { console.error("❌ CFR failed", String(e)); throw e; }),
    handleLeadTime(repo, token, limit, since).then(r => { console.log("✅ Lead Time done"); return r; }).catch(e => { console.error("❌ Lead Time failed", String(e)); throw e; }),
    handleIssueResolutionTime(repo, token, limit, since).then(r => { console.log("✅ MTTR done"); return r; }).catch(e => { console.error("❌ MTTR failed", String(e)); throw e; }),
    handleDeployFreq(repo, token, limit, since).then(r => { console.log("✅ Deploy Freq done"); return r; }).catch(e => { console.error("❌ Deploy Freq failed", String(e)); throw e; }),
  ]);

  console.log("✅ All metrics computed successfully");
  return {
    repo,
    details: { cfr, leadTime, mttr, deployFreq },
  };
}

function dedupeByPrNumber<T extends { pr: { number: number } }>(existing: T[], incoming: T[]): T[] {
  const seen = new Set(existing.map((r) => r.pr.number));
  return [...existing, ...incoming.filter((r) => !seen.has(r.pr.number))];
}

function dedupeDeployments<T extends { pr_number: number }>(existing: T[], incoming: T[]): T[] {
  const seen = new Set(existing.map((d) => d.pr_number));
  return [...existing, ...incoming.filter((d) => !seen.has(d.pr_number))];
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Number.parseFloat((values.reduce((s, v) => s + v, 0) / values.length).toFixed(2));
}

function mergeDoraMetrics(existing: Record<string, any> | null, result: Awaited<ReturnType<typeof handleAll>>) {
  const { cfr: newCfr, leadTime: newLeadTime, mttr: newMttr, deployFreq: newDeployFreq } = result.details;

  const cfr_details = { ...newCfr };

  const leadResults = dedupeByPrNumber(existing?.lead_time_details?.results ?? [], newLeadTime.results);
  const lead_time_details = {
    ...newLeadTime,
    results: leadResults,
    sample_size: leadResults.length,
    avg_lead_hours: avg(leadResults.map((r) => r.lead_hours)),
  };

  const mttrResults = dedupeByPrNumber(existing?.mttr_details?.results ?? [], newMttr.results);
  const mttr_details = {
    ...newMttr,
    results: mttrResults,
    sample_size: mttrResults.length,
    average_resolution_hours: avg(mttrResults.map((r) => r.resolution_hours)),
  };

  const allDeployments = dedupeDeployments(existing?.deploy_freq_details?.deployments ?? [], newDeployFreq.deployments);
  const now = new Date();
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const deploy_freq_details = {
    ...newDeployFreq,
    deployments: allDeployments,
    total_deployments: allDeployments.length,
    deployments_last_30_days: allDeployments.filter((d) => new Date(d.merged_at) >= last30).length,
    deployments_last_90_days: allDeployments.filter((d) => new Date(d.merged_at) >= last90).length,
  };

  const averages = {
    change_failure_rate: { value: cfr_details.change_failure_rate, unit: "%" },
    lead_time_for_changes: { value: lead_time_details.avg_lead_hours, unit: "hours" },
    mean_time_to_restore: { value: mttr_details.average_resolution_hours, unit: "hours" },
    deploy_frequency: {
      value: deploy_freq_details.total_deployments,
      last_30_days: deploy_freq_details.deployments_last_30_days,
      last_90_days: deploy_freq_details.deployments_last_90_days,
      unit: "deployments",
    },
  };

  return { averages, cfr_details, lead_time_details, mttr_details, deploy_freq_details };
}

async function saveDoraMetrics(linearSlug: string, url: string, result: Awaited<ReturnType<typeof handleAll>>) {
  console.log("🔍 Fetching existing dorametrics row for slug:", linearSlug);
  const { data: existing, error: fetchError } = await supabase.schema("portal")
    .from("dora_metrics")
    .select("cfr_details, lead_time_details, mttr_details, deploy_freq_details, last_called")
    .eq("linear_slug", linearSlug)
    .maybeSingle();

  if (fetchError) console.error("❌ Fetch existing error:", fetchError.message);
  console.log("📦 Existing row found:", !!existing);

  const merged = mergeDoraMetrics(existing, result);
  console.log("🔀 Merged metrics computed");

  const payload = { ...merged, url, last_called: new Date().toISOString() };

  let error;
  if (existing) {
    ({ error } = await supabase.schema("portal").from("dora_metrics").update(payload).eq("linear_slug", linearSlug));
  } else {
    const { data: customers, error: customerError } = await supabase.schema("portal")
      .from("customers")
      .select("customer_id")
      .eq("linear_slug", linearSlug)
      .limit(1);

    if (customerError) console.error("❌ Customer lookup error:", customerError.message);
    const customer = customers?.[0];
    if (!customer?.customer_id) throw new Error(`No customer found for linear_slug: ${linearSlug}`);

    // dora_metrics.customer_id is a FK to portal.users.id (the customer's user row),
    // not portal.customers.customer_id
    const { data: customerUsers, error: userError } = await supabase.schema("portal")
      .from("users")
      .select("id")
      .eq("customer_id", customer.customer_id)
      .eq("role", "customer")
      .order("created_at", { ascending: true });

    if (userError) console.error("❌ Customer user lookup error:", userError.message);
    const customerUserId = customerUsers?.[0]?.id;
    if (!customerUserId) throw new Error(`No customer user found for linear_slug: ${linearSlug}`);

    ({ error } = await supabase.schema("portal")
      .from("dora_metrics")
      .insert({ linear_slug: linearSlug, customer_id: customerUserId, ...payload }));
  }

  if (error) {
    console.error("❌ Supabase write error:", error.message, error.details);
    throw new Error(`Failed to save dora metrics: ${error.message}`);
  }
  console.log("✅ Supabase write successful");
}

Deno.serve(async (req) => {
  console.log(`📨 Request received: ${req.method} ${req.url}`);

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
    const { method, url: repoUrl, linear_slug, limit: rawLimit } = body;

    if (!repoUrl) {
      return new Response(JSON.stringify({ error: "Missing url param" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!linear_slug) {
      return new Response(JSON.stringify({ error: "Missing linear_slug param" }), {
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
      console.log("💾 Saving to dorametrics...");
      await saveDoraMetrics(linear_slug, repoUrl, result);
      console.log("✅ Saved to dorametrics");
      const serialized = JSON.stringify(result);
      console.log("✅ Response serialized, length:", serialized.length);
      return new Response(serialized, {
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
    console.error("❌ [dora] Unhandled error:", error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
