// @ts-nocheck
// Freezes each roadmap milestone's status for cycles that have already
// closed, into portal.milestone_cycle_snapshots — see the companion
// migration (20260827120000_create_milestone_cycle_snapshots.sql) for why.
// Meant to run on a daily cron (see the "allCustomers" method), same pattern
// as dora/index.ts's handleAllCustomers: insert-only, skips any (milestone,
// cycle) pair that already has a frozen row, so a closed cycle's snapshot is
// only ever written once.
import { corsHeaders, LINEAR_GRAPHQL } from "../utils/headers.ts";
import { supabase } from "../client.ts";
import { getAllCustomers } from "../issueMetrics/db.ts";
import { PROJECTS_QUERY, PROJECT_TEAM_QUERY, TEAM_CYCLES_QUERY } from "../roadmap/query.ts";

const MAX_PROJECT_PAGES = 20;

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
    throw new Error(`Linear API error: ${data.errors[0]?.message ?? "unknown"}`);
  }
  return data.data;
}

// PROJECTS_QUERY only returns 5 projects per page — a live "Load more"
// button is fine for a human browsing the timeline, but a correctness cron
// needs every project, so this pages through all of them.
async function fetchAllProjects(initiativeId: string) {
  const projects: any[] = [];
  let after: string | null = null;

  for (let page = 0; page < MAX_PROJECT_PAGES; page++) {
    const data = await linearRequest(PROJECTS_QUERY, { initiativeId, after });
    const pageProjects = data?.initiative?.projects?.nodes ?? [];
    projects.push(...pageProjects);

    const pageInfo = data?.initiative?.projects?.pageInfo;
    if (!pageInfo?.hasNextPage) break;
    after = pageInfo.endCursor;
  }

  return projects;
}

// Only ever called for a cycle that's already closed (see closedCycleIds
// below) — so "unstarted"/"in-progress" never apply here, unlike the live
// getBucketMilestoneStatus in components/roadmap/ProjectSummaryBar.tsx which
// also has to handle active/future cycles.
function computeClosedCycleStatus(issuesInCycle: any[]): "done" | "overdue" {
  const allDone = issuesInCycle.every((i) => i.completedAt || i.canceledAt);
  return allDone ? "done" : "overdue";
}

async function snapshotCustomer(linearSlug: string, schema: string) {
  const projects = await fetchAllProjects(linearSlug);
  if (!projects.length) return { inserted: 0, skipped: 0 };

  // Cycles belong to a team, not a project — same two-hop resolution as
  // roadmap/index.ts's fetchCyclesForInitiative (every project in an
  // initiative typically shares one team, so the first project is enough).
  const teamData = await linearRequest(PROJECT_TEAM_QUERY, { projectId: projects[0].id });
  const teamId = teamData?.project?.teams?.nodes?.[0]?.id;
  if (!teamId) return { inserted: 0, skipped: 0 };

  const cyclesData = await linearRequest(TEAM_CYCLES_QUERY, { teamId });
  const cycles: any[] = cyclesData?.team?.cycles?.nodes ?? [];
  const now = Date.now();
  const closedCycleIds = new Set(
    cycles
      .filter((c) => !c.isActive && c.endsAt && new Date(c.endsAt).getTime() < now)
      .map((c) => c.id),
  );
  if (!closedCycleIds.size) return { inserted: 0, skipped: 0 };

  const candidates: { milestone_id: string; cycle_id: string; linear_slug: string; status: string }[] = [];
  for (const project of projects) {
    for (const milestone of project.projectMilestones?.nodes ?? []) {
      const issuesByCycle = new Map<string, any[]>();
      for (const issue of milestone.issues?.nodes ?? []) {
        const cycleId = issue?.cycle?.id;
        if (!cycleId || !closedCycleIds.has(cycleId)) continue;
        const bucket = issuesByCycle.get(cycleId) ?? [];
        bucket.push(issue);
        issuesByCycle.set(cycleId, bucket);
      }
      for (const [cycleId, issues] of issuesByCycle) {
        candidates.push({
          milestone_id: milestone.id,
          cycle_id: cycleId,
          linear_slug: linearSlug,
          status: computeClosedCycleStatus(issues),
        });
      }
    }
  }
  if (!candidates.length) return { inserted: 0, skipped: 0 };

  const { data: existing, error: fetchError } = await supabase.schema(schema)
    .from("milestone_cycle_snapshots")
    .select("milestone_id, cycle_id")
    .in("milestone_id", candidates.map((c) => c.milestone_id));

  if (fetchError) throw new Error(`Failed to fetch existing snapshots: ${fetchError.message}`);

  const existingKeys = new Set((existing ?? []).map((r) => `${r.milestone_id}:${r.cycle_id}`));
  const newRows = candidates.filter((c) => !existingKeys.has(`${c.milestone_id}:${c.cycle_id}`));
  const skipped = candidates.length - newRows.length;

  if (newRows.length) {
    const { error: insertError } = await supabase.schema(schema)
      .from("milestone_cycle_snapshots")
      .insert(newRows);
    if (insertError) throw new Error(`Failed to insert snapshots: ${insertError.message}`);
  }

  return { inserted: newRows.length, skipped };
}

async function handleAllCustomers(schema: string) {
  const customers = await getAllCustomers(schema);
  const eligible = customers.filter((c) => c.linear_slug);

  let succeeded = 0;
  let failed = 0;
  const results: Record<string, unknown> = {};

  for (const customer of eligible) {
    try {
      results[customer.linear_slug] = await snapshotCustomer(customer.linear_slug, schema);
      succeeded++;
    } catch (error) {
      results[customer.linear_slug] = { error: error.message };
      failed++;
      console.error(`❌ [milestone-snapshots] failed for ${customer.linear_slug}:`, error.message);
    }
  }

  return { ok: true, succeeded, failed, total: eligible.length, results };
}

Deno.serve(async (req) => {
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
    const body = await req.json().catch(() => ({}));

    if (body.method === "allCustomers" || !body.linear_slug) {
      const summary = await handleAllCustomers(schema);
      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await snapshotCustomer(body.linear_slug, schema);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ [milestone-snapshots] Unhandled error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
