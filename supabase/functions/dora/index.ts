// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { supabase } from "../client.ts";
import { runWithConcurrency } from "../utils/concurrency.ts";
import { getAllCustomers } from "../issueMetrics/db.ts";
import { parseRepo } from "./github.ts";
import { handleCFR } from "./cfr.ts";
import { handleLatest } from "./latest.ts";
import { handleIssueResolutionTime } from "./mttr.ts";
import { handleLeadTime } from "./leadTime.ts";
import { handleDeployFreq } from "./deployFreq.ts";
import { pollBranchCreationEvents } from "./events.ts";

const handlers: Record<string, (repo: string, token: string, limit: number) => Promise<unknown>> = {
  cfr: handleCFR,
  latest: handleLatest,
  mttr: handleIssueResolutionTime,
  leadTime: handleLeadTime,
  deployFreq: handleDeployFreq,
  pollEvents: async (repo, token) => ({ recorded: await pollBranchCreationEvents(repo, token, "portal") }),
};

// Never look back less than this, even when resuming from a stored
// last_called. A fixed "last 24h" cutoff silently and permanently drops any
// qualifying merge that doesn't happen to land within 24h of a cron run — if
// the cron missed a day, or last_called got advanced without actually
// capturing everything up to that point (e.g. a row that was reset/recreated
// from scratch), that merge is gone for good, since the next run only ever
// looks at "last 24h from now" / "since last_called", never further back.
// Clamping to a minimum window makes this self-healing instead of
// permanently trusting a possibly-stale/corrupted checkpoint.
const MIN_LOOKBACK_DAYS = 90;

async function getSinceForCustomer(linearSlug: string, schema: string): Promise<Date> {
  const { data, error } = await supabase.schema(schema)
    .from("dora_metrics")
    .select("last_called")
    .ilike("linear_slug", linearSlug)
    .maybeSingle();

  if (error) {
    console.error(`⚠️ getSinceForCustomer: lookup failed for ${linearSlug}, falling back to ${MIN_LOOKBACK_DAYS}d window`, error.message);
  }

  const minLookback = new Date(Date.now() - MIN_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const lastCalled = data?.last_called ? new Date(data.last_called) : null;

  return lastCalled && lastCalled < minLookback ? lastCalled : minLookback;
}

async function handleAll(repo: string, token: string, limit: number, since: Date, schema = "portal") {
  console.log(`🚀 [${repo}] handleAll started`, { limit, since: since.toISOString() });

  // Best-effort: catches branch creations via GitHub's events feed when no
  // webhook is registered. Never blocks the run — leadTime/mttr fall back to
  // a first-commit-date approximation for anything this doesn't catch.
  await pollBranchCreationEvents(repo, token, schema)
    .then((n) => console.log(`✅ [${repo}] pollBranchCreationEvents done (${n} recorded)`))
    .catch((e) => console.error(`⚠️ [${repo}] pollBranchCreationEvents failed (non-fatal)`, e.message));

  // mttr reads the closed_date that leadTime writes for feat branches
  // (getLastFeatClosedBefore in db.ts), so leadTime must finish — and its
  // writes must land — before mttr runs. Racing them in the same Promise.all
  // let mttr read a feat's closed_date before leadTime had written it,
  // silently dropping that MTTR sample.
  const [cfr, leadTime, deployFreq] = await Promise.all([
    handleCFR(repo, token, limit).then(r => { console.log(`✅ [${repo}] CFR done:`, JSON.stringify(r)); return r; }).catch(e => { console.error(`❌ [${repo}] CFR failed`, String(e)); throw e; }),
    handleLeadTime(repo, token, limit, since).then(r => { console.log(`✅ [${repo}] Lead Time done: sample_size=${r.sample_size} avg_lead_hours=${r.avg_lead_hours}`); return r; }).catch(e => { console.error(`❌ [${repo}] Lead Time failed`, String(e)); throw e; }),
    handleDeployFreq(repo, token, limit, since).then(r => { console.log(`✅ [${repo}] Deploy Freq done: total=${r.total_deployments} last_30d=${r.deployments_last_30_days} last_90d=${r.deployments_last_90_days}`); return r; }).catch(e => { console.error(`❌ [${repo}] Deploy Freq failed`, String(e)); throw e; }),
  ]);

  const mttr = await handleIssueResolutionTime(repo, token, limit, since)
    .then(r => { console.log(`✅ [${repo}] MTTR done: sample_size=${r.sample_size} average_resolution_hours=${r.average_resolution_hours}`); return r; })
    .catch(e => { console.error(`❌ [${repo}] MTTR failed`, String(e)); throw e; });

  console.log(`✅ [${repo}] All metrics computed successfully`);
  return {
    repo,
    details: { cfr, leadTime, mttr, deployFreq },
  };
}

// Own cron entrypoint: no longer triggered per-customer from issueMetrics via
// HTTP, since GitHub's API is slow/rate-limited relative to Linear's and
// shouldn't share a run (and a timeout budget) with it. Mirrors what
// issueMetrics/index.ts's triggerDoraForCustomer used to do, just in-process.
const CUSTOMER_CONCURRENCY = 5;

async function handleAllCustomers(token: string, limit: number, schema: string) {
  const customers = await getAllCustomers(schema);
  const eligible = customers.filter(
    (c) => c.linear_slug && Array.isArray(c.project_url) && c.project_url.length > 0,
  );

  console.log(`🚀 [dora] handleAllCustomers started, eligible customers: ${eligible.length}`);

  let succeeded = 0;
  let failed = 0;

  await runWithConcurrency(eligible, CUSTOMER_CONCURRENCY, async (customer) => {
    try {
      const repo = parseRepo(customer.project_url as unknown as string);
      const since = await getSinceForCustomer(customer.linear_slug, schema);
      console.log(`➡️ [dora] handleAllCustomers processing slug=${customer.linear_slug} repo=${repo} since=${since.toISOString()}`);
      const result = await handleAll(repo, token, limit, since, schema);
      await saveDoraMetrics(customer.linear_slug, customer.project_url as unknown as string, result, schema);
      succeeded++;
    } catch (error) {
      failed++;
      console.error(`❌ [dora] handleAllCustomers failed for slug=${customer.linear_slug}:`, error.message);
    }
  });

  console.log(`✅ [dora] handleAllCustomers finished: ${succeeded} succeeded, ${failed} failed, ${eligible.length} total`);
  return { ok: true, succeeded, failed, total: eligible.length };
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

async function saveDoraMetrics(
  linearSlug: string,
  url: string,
  result: Awaited<ReturnType<typeof handleAll>>,
  schema: string,
) {
  console.log(`🔍 [${linearSlug}] Fetching existing dora_metrics row`);
  const { data: existing, error: fetchError } = await supabase.schema(schema)
    .from("dora_metrics")
    .select("cfr_details, lead_time_details, mttr_details, deploy_freq_details, last_called")
    .ilike("linear_slug", linearSlug)
    .maybeSingle();

  if (fetchError) console.error(`❌ [${linearSlug}] Fetch existing error:`, fetchError.message);
  console.log(`📦 [${linearSlug}] Existing row found:`, !!existing, existing ? `(last_called=${existing.last_called})` : "");

  const merged = mergeDoraMetrics(existing, result);
  console.log(`🔀 [${linearSlug}] Merged metrics computed`);
  console.log(`📊 [${linearSlug}] averages:`, JSON.stringify(merged.averages, null, 2));
  console.log(`📊 [${linearSlug}] sample sizes: lead_time=${merged.lead_time_details.sample_size} mttr=${merged.mttr_details.sample_size} deployments=${merged.deploy_freq_details.total_deployments} cfr(total_non_fix)=${merged.cfr_details.total_non_fix_deployments}`);

  const payload = { ...merged, url, last_called: new Date().toISOString() };

  let error;
  if (existing) {
    console.log(`📝 [${linearSlug}] Updating existing dora_metrics row`);
    ({ error } = await supabase.schema(schema).from("dora_metrics").update(payload).ilike("linear_slug", linearSlug));
  } else {
    console.log(`🆕 [${linearSlug}] No existing row — inserting a new one`);
    const { data: customers, error: customerError } = await supabase.schema(schema)
      .from("customers")
      .select("customer_id")
      .ilike("linear_slug", linearSlug)
      .limit(1);

    if (customerError) console.error(`❌ [${linearSlug}] Customer lookup error:`, customerError.message);
    const customer = customers?.[0];
    if (!customer?.customer_id) throw new Error(`No customer found for linear_slug: ${linearSlug}`);

    // dora_metrics.customer_id is a FK to portal.users.id (the customer's user row),
    // not portal.customers.customer_id
    const { data: customerUsers, error: userError } = await supabase.schema(schema)
      .from("users")
      .select("id")
      .eq("customer_id", customer.customer_id)
      .eq("role", "customer")
      .order("created_at", { ascending: true });

    if (userError) console.error(`❌ [${linearSlug}] Customer user lookup error:`, userError.message);
    const customerUserId = customerUsers?.[0]?.id;
    if (!customerUserId) throw new Error(`No customer user found for linear_slug: ${linearSlug}`);

    ({ error } = await supabase.schema(schema)
      .from("dora_metrics")
      .insert({ linear_slug: linearSlug, customer_id: customerUserId, ...payload }));
  }

  if (error) {
    console.error(`❌ [${linearSlug}] Supabase write error:`, error.message, error.details);
    throw new Error(`Failed to save dora metrics: ${error.message}`);
  }
  console.log(`✅ [${linearSlug}] Supabase write successful`);
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
    const schema = "portal";
    const token = Deno.env.get("GH_ORG_PAT");
    if (!token) throw new Error("Missing GH_ORG_PAT env var");

    const body = await req.json();
    const { method, url: repoUrl, linear_slug, limit: rawLimit } = body;

    if (!method) {
      return new Response(JSON.stringify({ error: "Missing method param" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const limit = Math.min(Number.parseInt(rawLimit ?? "100", 10), 500);

    if (method === "allCustomers") {
      const summary = await handleAllCustomers(token, limit, schema);
      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    const repo = parseRepo(repoUrl);

    if (method === "all") {
      const since = await getSinceForCustomer(linear_slug, schema);
      const result = await handleAll(repo, token, limit, since, schema);
      console.log("💾 Saving to dorametrics...");
      await saveDoraMetrics(linear_slug, repoUrl, result, schema);
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
