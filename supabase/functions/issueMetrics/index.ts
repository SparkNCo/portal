// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import {
  getCustomerBySlug,
  getAllCustomers,
  upsertIssueMetrics,
  upsertCycleMetrics,
  getMetricsBySlug,
} from "./db.ts";
import { fetchProjectDetails, fetchCycleIssues } from "./linear.ts";
import { buildIssueMetrics, buildCycleMetrics } from "./metrics.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const { searchParams } = new URL(req.url);

  if (req.method === "GET") {
    try {
      const slug = searchParams.get("slug");

      if (!slug) {
        return new Response(JSON.stringify({ error: "Missing slug" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const customer = await getCustomerBySlug(slug);
      const linearProjects: string[] = customer.linear_projects ?? [];

      const [metrics, projects] = await Promise.all([
        getMetricsBySlug(linearProjects),
        fetchProjectDetails(linearProjects),
      ]);

      return new Response(JSON.stringify({ ...metrics, projects }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  try {
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
        return { projectId: project.id, cycles: Array.from(cyclesMap.values()) };
      });

      const activeCycleEntries: { cycleId: string; projectId: string }[] = [];
      for (const { projectId, cycles } of cyclesByProject) {
        for (const cycle of cycles) {
          activeCycleEntries.push({ cycleId: cycle.id, projectId });
        }
      }

      const cycleIssues = await Promise.all(
        activeCycleEntries.map(async ({ cycleId, projectId }) => {
          const issues = await fetchCycleIssues(cycleId);
          return { cycleId, projectId, issues };
        }),
      );

      const metrics = buildIssueMetrics(cycleIssues, customer.linear_slug);
      const cycles = buildCycleMetrics(cyclesByProject, customer.linear_slug);

      await Promise.all([
        upsertIssueMetrics(metrics),
        upsertCycleMetrics(cycles),
      ]);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
