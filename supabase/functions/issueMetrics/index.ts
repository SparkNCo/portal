// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { supabase } from "../client.ts";
import { runWithConcurrency } from "../utils/concurrency.ts";
import {
  getAllCustomers,
  upsertIssueMetrics,
  upsertCycleMetrics,
  getCycleMetricsByCustomerId,
  getIssueMetricsByCustomerId,
  getProjectIdsBySlug,
} from "./db.ts";
import { fetchProjectDetails, fetchCycleIssues, fetchCycleDetails } from "./linear.ts";
import { buildIssueMetrics, buildCycleMetrics } from "./metrics.ts";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleGet(searchParams: URLSearchParams, schema: string) {
  const slug = searchParams.get("slug");
  if (!slug) return jsonResponse({ error: "Missing slug" }, 400);
  console.log("hi");

  const { data: customerRow, error: customerError } = await supabase.schema(schema)
    .from("customers")
    .select("customer_id, linear_slug")
    .eq("clientName", slug)
    .maybeSingle();

  if (customerError) throw new Error(`Customer lookup error: ${customerError.message}`);
  if (!customerRow?.linear_slug)
    return jsonResponse({ error: `No customer found with clientName: ${slug}` }, 404);

  // issue_metrics / cycle_metrics key off the customer's user row id (role = "customer"),
  // not the customers table's own customer_id
  const { data: customerUsers, error: customerUserError } = await supabase.schema(schema)
    .from("users")
    .select("id")
    .eq("customer_id", customerRow.customer_id)
    .eq("role", "customer")
    .order("created_at", { ascending: true });

  if (customerUserError) throw new Error(`Customer user lookup error: ${customerUserError.message}`);
  const customerUser = customerUsers?.[0];
  if (!customerUser?.id)
    return jsonResponse({ error: `No customer user linked to clientName: ${slug}` }, 404);
  if (customerUsers.length > 1) {
    console.warn(`[issueMetrics] Multiple customer users linked to customer_id ${customerRow.customer_id}; using oldest (${customerUser.id})`);
  }

  const [issue_metrics, cycle_metrics] = await Promise.all([
    getIssueMetricsByCustomerId(customerUser.id, schema),
    getCycleMetricsByCustomerId(customerUser.id, schema),
  ]);

  return jsonResponse({ issue_metrics, cycle_metrics });
}

// Fetch each unique cycle exactly once, then group issues by their actual project.id.
// This prevents double-counting when the same cycle_id appears across multiple projects.
async function resolveCycleIssues(
  cyclesByProject: { projectId: string; cycles: any[] }[],
) {
  const uniqueCycleIds = [
    ...new Set(
      cyclesByProject.flatMap(({ cycles }) => cycles.map((c) => c.id)),
    ),
  ];

  const fetched = await Promise.all(
    uniqueCycleIds.map(async (cycleId) => [
      cycleId,
      await fetchCycleIssues(cycleId),
    ]),
  );
  const issuesByCycle = new Map<string, any[]>(fetched);

  const result: { cycleId: string; projectId: string; issues: any[] }[] = [];
  for (const [cycleId, issues] of issuesByCycle) {
    const byProject = new Map<string, any[]>();
    for (const issue of issues) {
      const pid = issue.project?.id;
      if (!pid) continue;
      if (!byProject.has(pid)) byProject.set(pid, []);
      byProject.get(pid).push(issue);
    }
    for (const [projectId, projectIssues] of byProject) {
      result.push({ cycleId, projectId, issues: projectIssues });
    }
  }
  return result;
}

// Resolves the light {id, isActive} cycle stubs (from GET_PROJECT_ACTIVE_CYCLES_QUERY)
// into full cycle detail objects, fetching each unique cycle exactly once
// regardless of how many projects/issues reference it.
async function resolveFullCycles(
  cyclesByProject: { projectId: string; projectName: string; cycles: any[] }[],
) {
  const uniqueCycleIds = [
    ...new Set(
      cyclesByProject.flatMap(({ cycles }) => cycles.map((c) => c.id)),
    ),
  ];

  const fetched = await Promise.all(
    uniqueCycleIds.map(async (cycleId) => [
      cycleId,
      await fetchCycleDetails(cycleId),
    ]),
  );
  const cycleById = new Map<string, any>(fetched);

  return cyclesByProject.map(({ projectId, projectName, cycles }) => ({
    projectId,
    projectName,
    cycles: cycles.map((c) => cycleById.get(c.id)).filter(Boolean),
  }));
}

async function handlePut(req: Request, schema: string) {
  const { linear_slug } = await req.json();
  if (!linear_slug) return jsonResponse({ error: "Missing linear_slug" }, 400);

  // Step 1: resolve project IDs from Supabase by customer slug
  const projectIds = await getProjectIdsBySlug(linear_slug, schema);
  if (!projectIds.length)
    return jsonResponse(
      { error: `No projects found for slug: ${linear_slug}` },
      404,
    );

  // Step 2: fetch project details to discover active cycles
  const projects = (await fetchProjectDetails(projectIds)).filter(Boolean);

  const cyclesByProject = projects.map((project: any) => {
    const cyclesMap = new Map();
    for (const issue of project.issues?.nodes || []) {
      if (issue.cycle?.id && issue.cycle.isActive === true) {
        cyclesMap.set(issue.cycle.id, issue.cycle);
      }
    }
    return {
      projectId: project.id,
      projectName: project.name,
      cycles: Array.from(cyclesMap.values()),
    };
  });

  // Step 3: fetch issues per unique cycle, grouped by actual project
  const cycleIssues = await resolveCycleIssues(cyclesByProject);

  // Step 4: build metrics and return status summary per project
  const metrics = buildIssueMetrics(cycleIssues, linear_slug);

  const byProject: Record<string, Record<string, number>> = {};
  for (const m of metrics) {
    if (!byProject[m.project_id]) byProject[m.project_id] = {};
    byProject[m.project_id][m.status] = m.count;
  }

  return jsonResponse({ projects: byProject });
}

// Debug trace for one specific customer (users.id) while diagnosing why
// their cycle_metrics isn't updating — remove once resolved.
const DEBUG_CUSTOMER_ID = "60ecb62b-05fb-452f-b2fe-bf7bc84765c3";

async function processIssueMetricsForCustomer(
  customer: { id: string; linear_projects?: string[] | null },
  schema: string,
) {
  const isDebugTarget = customer.id === DEBUG_CUSTOMER_ID;
  const linearProjects: string[] = customer.linear_projects ?? [];

  if (isDebugTarget) {
    console.log("[DEBUG issueMetrics] customer found in getAllCustomers()", {
      customerId: customer.id,
      linearProjects,
    });
  }

  if (!linearProjects.length) {
    console.log(`⏭️ [issueMetrics] skipping customer ${customer.id}: no linear_projects`);
    return;
  }

  // A failure for one customer (Linear rate limit, timeout, bad project id, etc.)
  // must not stop the rest of the batch from being processed that day.
  try {
    console.log(`🔧 [issueMetrics] processing customer ${customer.id}, linear_projects=`, linearProjects);

    const projects = (await fetchProjectDetails(linearProjects)).filter(Boolean);

    if (isDebugTarget) {
      console.log(
        "[DEBUG issueMetrics] projects fetched from Linear:",
        projects.map((p: any) => ({
          id: p.id,
          name: p.name,
          issueCount: p.issues?.nodes?.length ?? 0,
        })),
      );
    }

    const cyclesByProjectLight = projects.map((project: any) => {
      const cyclesMap = new Map();
      for (const issue of project.issues?.nodes || []) {
        if (issue.cycle?.id && issue.cycle.isActive === true) {
          cyclesMap.set(issue.cycle.id, issue.cycle);
        }
      }
      return {
        projectId: project.id,
        projectName: project.name,
        cycles: Array.from(cyclesMap.values()),
      };
    });

    if (isDebugTarget) {
      console.log(
        "[DEBUG issueMetrics] active cycles found per project:",
        cyclesByProjectLight.map((p) => ({
          projectId: p.projectId,
          projectName: p.projectName,
          cycleCount: p.cycles.length,
          cycleIds: p.cycles.map((c: any) => c.id),
        })),
      );
    }

    const [cycleIssues, cyclesByProject] = await Promise.all([
      resolveCycleIssues(cyclesByProjectLight),
      resolveFullCycles(cyclesByProjectLight),
    ]);

    const metrics = buildIssueMetrics(cycleIssues, customer.id);
    const cycles = buildCycleMetrics(
      cyclesByProject,
      customer.id,
      metrics,
      cycleIssues,
    );

    if (isDebugTarget) {
      console.log("[DEBUG issueMetrics] built metrics/cycles before upsert", {
        metricsCount: metrics.length,
        cyclesCount: cycles.length,
        cycles: cycles.map((c) => ({
          project_id: c.project_id,
          cycle_id: c.cycle_id,
          name: c.name,
          is_active: c.is_active,
        })),
      });
    }

    await Promise.all([
      upsertIssueMetrics(metrics, schema),
      upsertCycleMetrics(cycles, schema),
    ]);

    if (isDebugTarget) {
      console.log("[DEBUG issueMetrics] upsert completed successfully");
    }

    console.log(`✅ [issueMetrics] saved metrics for customer ${customer.id}`);
  } catch (err) {
    if (isDebugTarget) {
      console.error("[DEBUG issueMetrics] threw before/during upsert:", err);
    }
    console.error(`❌ [issueMetrics] failed to process customer ${customer.id}:`, String(err));
  }
}

// DORA metrics are no longer triggered from here — they run on their own
// cron against dora's `allCustomers` method, since GitHub's API is slow/rate
// -limited relative to Linear's and shouldn't share a run (or timeout
// budget) with these Linear-only metrics.
const CUSTOMER_CONCURRENCY = 5;

async function handlePost(schema: string) {
  const customers = await getAllCustomers(schema);

  console.log(`🚀 [issueMetrics] handlePost started, customers found:`, customers.length);

  console.log(
    "[DEBUG issueMetrics] is target customer present in getAllCustomers()?",
    customers.some((c) => c.id === DEBUG_CUSTOMER_ID),
  );

  await runWithConcurrency(customers, CUSTOMER_CONCURRENCY, async (customer) => {
    await processIssueMetricsForCustomer(customer, schema);
  });

  console.log(`✅ [issueMetrics] handlePost finished`);

  return jsonResponse({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const schema = "portal";
  const { searchParams } = new URL(req.url);

  try {
    if (req.method === "GET") return await handleGet(searchParams, schema);
    if (req.method === "PUT") return await handlePut(req, schema);
    return await handlePost(schema);
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
});
