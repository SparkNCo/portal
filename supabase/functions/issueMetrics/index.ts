// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { getCustomerBySlug, upsertIssueMetrics, upsertCycleMetrics, getMetricsByProject } from "./db.ts";
import { fetchProjectsAndMilestones, fetchIssuesForMilestones, mergeData } from "./linear.ts";
import { buildIssueMetrics, buildCycleMetrics } from "./metrics.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const { searchParams } = new URL(req.url);

  if (req.method === "GET") {
    try {
      const projectId = searchParams.get("project_id");

      if (!projectId) {
        return new Response(JSON.stringify({ error: "Missing project_id" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const data = await getMetricsByProject(projectId);

      return new Response(JSON.stringify(data), {
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

    if (!customer.linear_initiative_id) {
      throw new Error("No initiative configured");
    }

    const initiative = await fetchProjectsAndMilestones(customer.linear_slug);

    const milestoneIds = initiative.projects.nodes.flatMap((p: any) =>
      p.projectMilestones.nodes.map((m: any) => m.id),
    );

    const issuesByMilestone = await fetchIssuesForMilestones(milestoneIds);

    const finalData = mergeData(initiative, issuesByMilestone);

    const metrics = buildIssueMetrics(finalData, customer.linear_slug);
    const cycles = buildCycleMetrics(finalData, customer.linear_slug);

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
