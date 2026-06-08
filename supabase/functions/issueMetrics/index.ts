// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { supabase } from "../client.ts";
import {
  getAllCustomers,
  upsertIssueMetrics,
  upsertCycleMetrics,
  getCycleMetricsByCustomerId,
  getIssueMetricsByCustomerId,
  getProjectIdsBySlug,
} from "./db.ts";
import { fetchProjectDetails, fetchCycleIssues } from "./linear.ts";
import { buildIssueMetrics, buildCycleMetrics } from "./metrics.ts";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleGet(searchParams: URLSearchParams) {
  const slug = searchParams.get("slug");
  if (!slug) return jsonResponse({ error: "Missing slug" }, 400);
  console.log("hi");

  const { data: customerRow, error: customerError } = await supabase.schema("portal")
    .from("customers")
    .select("customer_id, linear_slug")
    .eq("clientName", slug)
    .maybeSingle();

  if (customerError) throw new Error(`Customer lookup error: ${customerError.message}`);
  if (!customerRow?.linear_slug)
    return jsonResponse({ error: `No customer found with clientName: ${slug}` }, 404);

  // issue_metrics / cycle_metrics key off the customer's user row id (role = "customer"),
  // not the customers table's own customer_id
  const { data: customerUsers, error: customerUserError } = await supabase.schema("portal")
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
    getIssueMetricsByCustomerId(customerUser.id),
    getCycleMetricsByCustomerId(customerUser.id),
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

async function handlePut(req: Request) {
  const { linear_slug } = await req.json();
  if (!linear_slug) return jsonResponse({ error: "Missing linear_slug" }, 400);

  // Step 1: resolve project IDs from Supabase by customer slug
  const projectIds = await getProjectIdsBySlug(linear_slug);
  if (!projectIds.length)
    return jsonResponse(
      { error: `No projects found for slug: ${linear_slug}` },
      404,
    );

  // Step 2: fetch project details to discover active cycles
  const projects = await fetchProjectDetails(projectIds);

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

async function triggerDoraForAllCustomers() {
  const { data: clients, error } = await supabase.schema("portal")
    .from("customers")
    .select("linear_slug, project_url")
    .not("linear_slug", "is", null)
    .not("project_url", "is", null);

  if (error) throw new Error(`Customers lookup error: ${error.message}`);

  const eligible = (clients ?? []).filter(
    (c) => Array.isArray(c.project_url) && c.project_url.length > 0,
  );

  const doraUrl = `${Deno.env.get("PROJECT_URL")}/functions/v1/dora`;
  const authHeader = `Bearer ${Deno.env.get("SERVICE_SECRET_KEY")}`;

  await Promise.all(
    eligible.map((client) =>
      fetch(doraUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          method: "all",
          url: client.project_url,
          linear_slug: client.linear_slug,
        }),
      }),
    ),
  );
}

async function handlePost() {
  const customers = await getAllCustomers();

  for (const customer of customers) {
    const linearProjects: string[] = customer.linear_projects ?? [];
    if (!linearProjects.length) continue;

    const projects = await fetchProjectDetails(linearProjects);

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

    const cycleIssues = await resolveCycleIssues(cyclesByProject);

    const metrics = buildIssueMetrics(cycleIssues, customer.id);
    const cycles = buildCycleMetrics(
      cyclesByProject,
      customer.id,
      metrics,
      cycleIssues,
    );

    await Promise.all([
      upsertIssueMetrics(metrics),
      upsertCycleMetrics(cycles),
    ]);
  }

  await triggerDoraForAllCustomers();

  return jsonResponse({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const { searchParams } = new URL(req.url);

  try {
    if (req.method === "GET") return await handleGet(searchParams);
    if (req.method === "PUT") return await handlePut(req);
    return await handlePost();
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
});
