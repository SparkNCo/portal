// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import {
  getCustomerBySlug,
  upsertIssueMetrics,
  upsertCycleMetrics,
  getMetricsBySlug,
} from "./db.ts";
import {
  fetchProjectsAndMilestones,
  fetchIssuesForMilestones,
  fetchCyclesForProjects,
  fetchProjectDetails,
  mergeData,
} from "./linear.ts";
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

    if (!customer.linear_initiative_id) {
      throw new Error("No initiative configured");
    }

    const initiative = await fetchProjectsAndMilestones(customer.linear_slug);

    const projectTeams = initiative.projects.nodes.flatMap((p: any) =>
      p.teams.nodes.map((t: any) => ({ projectId: p.id, teamId: t.id })),
    );
    console.log("ACA TOY projectTeams", projectTeams);

    const milestoneIds = initiative.projects.nodes.flatMap((p: any) =>
      p.projectMilestones.nodes.map((m: any) => m.id),
    );
    console.log("ACA TOY 2 milestoneIds", milestoneIds);

    const [issuesByMilestone, cyclesByProject] = await Promise.all([
      fetchIssuesForMilestones(milestoneIds),
      fetchCyclesForProjects(projectTeams),
    ]);
    console.log("ACA TOY 3 ", issuesByMilestone);

    const finalData = mergeData(initiative, issuesByMilestone);

    const metrics = buildIssueMetrics(finalData, customer.linear_slug);
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
