// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import {
  getCustomerBySlug,
  upsertIssueMetrics,
  upsertCycleMetrics,
  getMetricsBySlug,
} from "./db.ts";
import { fetchProjectDetails } from "./linear.ts";
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
      console.log("linear_slug:", customer.linear_slug);
      console.log("linear_projects:", customer.linear_projects);

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
    const slug = searchParams.get("slug");

    if (!slug) {
      return new Response(JSON.stringify({ error: "Missing slug" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const customer = await getCustomerBySlug(slug);

    const linearProjects: string[] = customer.linear_projects ?? [];
    const projects = await fetchProjectDetails(linearProjects);

    console.log("linear_slug:", customer.linear_slug);

    const cyclesByProject = projects.map((project: any) => {
      const cyclesMap = new Map();
      for (const issue of project.issues?.nodes || []) {
        if (issue.cycle?.id) {
          cyclesMap.set(issue.cycle.id, issue.cycle);
        }
      }
      return { projectId: project.id, cycles: Array.from(cyclesMap.values()) };
    });

    const metrics = buildIssueMetrics(projects, customer.linear_slug);
    const cycles = buildCycleMetrics(cyclesByProject, customer.linear_slug);

    await Promise.all([
      upsertIssueMetrics(metrics),
      upsertCycleMetrics(cycles),
    ]);

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
