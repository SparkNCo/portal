// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders, LINEAR_GRAPHQL } from "../utils/headers.ts";
import { escapeIlike } from "../utils/slug.ts";
import {
  PROJECTS_QUERY,
  PROJECT_TEAM_QUERY,
  TEAM_CYCLES_QUERY,
  CYCLE_ISSUES_QUERY,
  PROJECT_ISSUES_QUERY,
  MILESTONE_ISSUES_QUERY,
} from "./query.ts";

async function getCustomerBySlug(slug: string, schema: string) {
  console.log("[roadmap] getCustomerBySlug: querying customers", { schema, clientName: slug });

  const { data, error } = await supabase.schema(schema)
    .from("customers")
    .select(
      `
      linear_projects,
      linear_slug
    `,
    )
    .ilike("clientName", escapeIlike(slug))
    .maybeSingle();

  if (error) {
    console.error("[roadmap] getCustomerBySlug: supabase error", error.message);
    throw new Error("Customer not found");
  }

  if (!data) {
    console.error("[roadmap] getCustomerBySlug: no customer row for clientName", slug);
    throw new Error("Customer not found");
  }

  console.log("[roadmap] getCustomerBySlug: found customer", data);

  return data;
}

async function linearRequest(query: string, variables: Record<string, unknown>) {
  const res = await fetch(LINEAR_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: Deno.env.get("LINEAR_API_KEY")!,
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await res.json();

  if (data.errors) {
    console.error("[roadmap] Linear GraphQL errors", JSON.stringify(data.errors));
    throw new Error(`Linear API error: ${data.errors[0]?.message ?? "unknown"}`);
  }

  return data.data;
}

async function fetchFromLinear(initiativeId: string, after: string | null) {
  console.log("[roadmap] fetchFromLinear: requesting initiative", initiativeId, "after", after);

  const data = await linearRequest(PROJECTS_QUERY, { initiativeId, after });

  const projects = data?.initiative?.projects?.nodes ?? [];
  console.log(
    "[roadmap] fetchFromLinear: projects returned",
    projects.length,
    projects.map((p: any) => ({
      name: p.name,
      milestones: p.projectMilestones?.nodes?.length ?? 0,
    })),
  );

  if (!data?.initiative) {
    console.error("[roadmap] fetchFromLinear: no initiative found for id", initiativeId);
  }

  return data;
}

// Cycles belong to a team, not a project — resolve the first project's team,
// then fetch that team's full cycle list. Every project in an initiative
// typically shares one team, so the first project found is enough.
async function fetchCyclesForInitiative(projects: any[]) {
  const firstProjectId = projects[0]?.id;
  if (!firstProjectId) return { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };

  const teamData = await linearRequest(PROJECT_TEAM_QUERY, { projectId: firstProjectId });
  const teamId = teamData?.project?.teams?.nodes?.[0]?.id;
  if (!teamId) {
    console.error("[roadmap] fetchCyclesForInitiative: no team found for project", firstProjectId);
    return { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
  }

  const cyclesData = await linearRequest(TEAM_CYCLES_QUERY, { teamId });
  return cyclesData?.team?.cycles ?? { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
}

async function fetchCycleIssues(
  cycleId: string,
  after: string | null,
  projectId: string | null,
  milestoneId: string | null,
) {
  const filter: Record<string, unknown> = {};
  if (projectId) filter.project = { id: { eq: projectId } };
  if (milestoneId) filter.projectMilestone = { id: { eq: milestoneId } };

  console.log("[roadmap] fetchCycleIssues: requesting cycle", {
    cycleId,
    after,
    projectId,
    milestoneId,
  });

  const data = await linearRequest(CYCLE_ISSUES_QUERY, {
    cycleId,
    after,
    filter: Object.keys(filter).length ? filter : null,
  });

  return data?.cycle?.issues ?? { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
}

// Used when a milestone is clicked directly (no cycle) — every issue in it,
// across every cycle it spans, takes priority over projectId when both are
// present since a milestone already belongs to exactly one project.
async function fetchMilestoneIssues(milestoneId: string, after: string | null) {
  console.log("[roadmap] fetchMilestoneIssues: requesting milestone", { milestoneId, after });
  const data = await linearRequest(MILESTONE_ISSUES_QUERY, { milestoneId, after });
  return data?.projectMilestone?.issues ?? { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
}

// Used when a project header is clicked directly (no cycle, no milestone) —
// every issue in the project across every cycle and milestone.
async function fetchProjectIssues(projectId: string, after: string | null) {
  console.log("[roadmap] fetchProjectIssues: requesting project", { projectId, after });
  const data = await linearRequest(PROJECT_ISSUES_QUERY, { projectId, after });
  return data?.project?.issues ?? { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const schema = "portal";
    const { searchParams } = new URL(req.url);

    const cycleId = searchParams.get("cycleId");
    if (cycleId) {
      const after = searchParams.get("after");
      const projectId = searchParams.get("projectId");
      const milestoneId = searchParams.get("milestoneId");
      const issues = await fetchCycleIssues(cycleId, after, projectId, milestoneId);
      return new Response(JSON.stringify(issues), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // No cycle selected — a project or milestone was clicked directly, so
    // every issue under it (across every cycle) is wanted instead of one
    // cycle's worth. Milestone takes priority since it already implies a
    // single project.
    const noCycleMilestoneId = searchParams.get("milestoneId");
    const noCycleProjectId = searchParams.get("projectId");
    if (noCycleMilestoneId || noCycleProjectId) {
      const after = searchParams.get("after");
      const issues = noCycleMilestoneId
        ? await fetchMilestoneIssues(noCycleMilestoneId, after)
        : await fetchProjectIssues(noCycleProjectId!, after);
      return new Response(JSON.stringify(issues), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    const rawSlug = searchParams.get("slug");
    const slug = rawSlug ? decodeURIComponent(rawSlug) : null;

    if (!slug) {
      return new Response(JSON.stringify({ error: "Missing slug" }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }
    console.log("[roadmap] request received for slug", slug);

    // ✅ Fetch customer
    const customer = await getCustomerBySlug(slug, schema);

    if (!customer.linear_slug) {
      console.error("[roadmap] customer has no linear_slug configured", { slug });
      return new Response(
        JSON.stringify({ error: "No Linear initiative configured" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const initiativeId = customer.linear_slug;
    const projectsAfter = searchParams.get("projectsAfter");

    const data = await fetchFromLinear(initiativeId, projectsAfter);

    // Cycles are team-wide and already fully fetched (first: 100) on the
    // initial page, so a "load more projects" request (projectsAfter set)
    // skips re-fetching them — the frontend already has the full list.
    const cycles = projectsAfter
      ? { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } }
      : await fetchCyclesForInitiative(data?.initiative?.projects?.nodes ?? []);

    console.log("[roadmap] returning response for slug", slug, "- cycles:", cycles.nodes.length);

    return new Response(JSON.stringify({ ...data, cycles }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[roadmap] request failed", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
