// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { supabase } from "../client.ts";

const LINEAR_GRAPHQL = "https://api.linear.app/graphql";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function linearFetch(query: string, variables: Record<string, unknown>) {
  const res = await fetch(LINEAR_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: Deno.env.get("LINEAR_API_KEY")!,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) throw new Error(`Linear API error: ${JSON.stringify(json.errors)}`);
  return json.data;
}

const INITIATIVE_PROJECTS_QUERY = `
  query GetInitiativeProjects($initiativeId: String!) {
    initiative(id: $initiativeId) {
      id
      name
      projects {
        nodes { id name }
      }
    }
  }
`;

// Shallow paginated query — only cycle id/number/isActive to stay under complexity limits
const PROJECT_CYCLE_IDS_QUERY = `
  query GetProjectCycleIds($projectId: String!, $after: String) {
    project(id: $projectId) {
      issues(first: 250, after: $after) {
        nodes {
          cycle { id number isActive }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const CYCLE_DETAILS_QUERY = `
  query GetCycleDetails($cycleId: String!) {
    cycle(id: $cycleId) {
      id
      number
      name
      description
      startsAt
      endsAt
      isActive
      completedAt
      scopeHistory
      completedScopeHistory
      issues {
        nodes {
          id
          number
          title
          priority
          dueDate
          addedToCycleAt
          estimate
          state { name type }
          labels(first: 3) { nodes { name } }
        }
      }
    }
  }
`;

// Returns a map of cycleId → Set<projectId> for the given project
async function getCycleProjectMap(projectId: string): Promise<Map<string, string>> {
  const cycleToProject = new Map<string, string>();
  let after: string | undefined;

  do {
    const data = await linearFetch(PROJECT_CYCLE_IDS_QUERY, { projectId, after });
    const issues = data?.project?.issues;
    for (const issue of issues?.nodes ?? []) {
      if (issue.cycle?.id && !issue.cycle.isActive && !cycleToProject.has(issue.cycle.id)) {
        cycleToProject.set(issue.cycle.id, projectId);
      }
    }
    after = issues?.pageInfo?.hasNextPage ? issues.pageInfo.endCursor : undefined;
  } while (after);

  return cycleToProject;
}

function buildSummary(rows: any[], cycleNumber: number | undefined) {
  return rows
    .map((r) => {
      const base = { cycle_id: r.cycle_id, number: r.number, name: r.name, project_name: r.project_name };
      return cycleNumber == null ? base : { ...base, uncompleted_issues: r.uncompleted_issues_upon_close };
    })
    .sort((a, b) => a.number - b.number);
}

function buildRow(cycle: any, projectId: string, projectName: string, linearSlug: string) {
  const allIssues: any[] = cycle.issues?.nodes ?? [];
  const uncompletedIssues = allIssues.filter(
    (i) => i.state?.type !== "completed" && i.state?.type !== "cancelled",
  );

  return {
    customer_id: linearSlug,
    project_id: projectId,
    project_name: projectName,
    cycle_id: cycle.id,
    number: cycle.number,
    name: cycle.name ?? null,
    description: cycle.description ?? null,
    starts_at: cycle.startsAt ?? null,
    ends_at: cycle.endsAt ?? null,
    is_active: cycle.isActive ?? false,
    completed_at: !cycle.isActive && cycle.endsAt
      ? cycle.endsAt.replace("T", " ").replace(/Z$/, "+00")
      : null,
    scope_history: cycle.scopeHistory ?? [],
    completed_scope_history: cycle.completedScopeHistory ?? [],
    uncompleted_issues_upon_close: uncompletedIssues.map((i) => ({
      id: i.id,
      number: i.number,
      title: i.title,
      priority: i.priority,
      dueDate: i.dueDate ?? null,
      addedToCycleAt: i.addedToCycleAt,
      state: i.state?.name ?? null,
    })),
    cycle_issue_ids: allIssues.map((i) => i.id),
    issues_averages: [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Use POST with body { initiative_id, linear_slug }" }, 405);
  }

  try {
    const body = await req.json();
    const { initiative_id: initiativeId, linear_slug: linearSlug, cycle_number: cycleNumber } = body;

    if (!initiativeId) return jsonResponse({ error: "Missing initiative_id" }, 400);
    if (!linearSlug) return jsonResponse({ error: "Missing linear_slug" }, 400);

    // Step 1: get project IDs from initiative
    const initiativeData = await linearFetch(INITIATIVE_PROJECTS_QUERY, { initiativeId });
    const initiative = initiativeData?.initiative;
    if (!initiative) return jsonResponse({ error: "Initiative not found" }, 404);

    const projects: { id: string; name: string }[] = initiative.projects?.nodes ?? [];
    if (!projects.length) {
      return jsonResponse({ initiative: initiative.name, upserted: 0, cycles: [] });
    }

    const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

    // Step 2: collect cycleId → projectId mapping across all projects
    const maps = await Promise.all(projects.map((p) => getCycleProjectMap(p.id)));
    const cycleToProject = new Map<string, string>();
    for (const m of maps) {
      for (const [cycleId, projectId] of m) {
        if (!cycleToProject.has(cycleId)) cycleToProject.set(cycleId, projectId);
      }
    }

    // Step 3: fetch full cycle details in parallel
    const cycleIds = [...cycleToProject.keys()];
    const cycleDetails = await Promise.all(
      cycleIds.map(async (cycleId) => {
        const data = await linearFetch(CYCLE_DETAILS_QUERY, { cycleId });
        return data?.cycle ?? null;
      }),
    );

    // Build upsert rows
    const rows = cycleDetails
      .filter(Boolean)
      .filter((cycle) => cycleNumber == null || cycle.number === cycleNumber)
      .map((cycle) => {
        const projectId = cycleToProject.get(cycle.id) ?? "";
        const projectName = projectNameById.get(projectId) ?? "";
        return buildRow(cycle, projectId, projectName, linearSlug);
      });

    if (!rows.length) {
      return jsonResponse({ initiative: initiative.name, inserted: 0, skipped: 0, cycles: [] });
    }

    // Check which (project_id, number) pairs already exist — don't overwrite them
    const projectIds = [...new Set(rows.map((r) => r.project_id))];
    const numbers = [...new Set(rows.map((r) => r.number))];

    const { data: existing, error: fetchError } = await supabase.schema("portal")
      .from("cycle_metrics")
      .select("project_id, number")
      .ilike("customer_id", linearSlug)
      .in("project_id", projectIds)
      .in("number", numbers);

    if (fetchError) throw new Error(`Supabase fetch failed: ${fetchError.message}`);

    const existingKeys = new Set(
      (existing ?? []).map((r) => `${r.project_id}:${r.number}`),
    );

    const newRows = rows.filter((r) => !existingKeys.has(`${r.project_id}:${r.number}`));
    const skipped = rows.length - newRows.length;

    if (newRows.length) {
      const { error: insertError } = await supabase.schema("portal").from("cycle_metrics").insert(newRows);
      if (insertError) throw new Error(`Supabase insert failed: ${insertError.message}`);
    }

    const cyclesSummary = buildSummary(rows, cycleNumber);

    return jsonResponse({
      initiative: initiative.name,
      inserted: newRows.length,
      skipped,
      cycles: cyclesSummary,
    });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
});
