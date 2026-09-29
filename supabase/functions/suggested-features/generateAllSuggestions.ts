// @ts-nocheck
import { supabase } from "../client.ts";
import { syncCustomerLinearProjects } from "../issues/syncLinearProjects.ts";
import { runWithConcurrency } from "../utils/concurrency.ts";
import { escapeIlike } from "../utils/slug.ts";
import { generateSuggestionForProject } from "./generateSuggestion.ts";

// POST /suggested-features/generate-all — weekly cron target (see
// supabase/migrations/..._schedule_suggested_features_cron.sql). Per
// ticket: "Run method once for each project in the initiative."
//
// For every customer:
//   1. `slug` = customer.clientName.toLowerCase() — same derivation every
//      other per-customer route slug in this app uses.
//   2. `customer.linear_slug` is the Linear initiative id, used directly as
//      `project_slug` (this already has it straight from the row — no
//      clientName -> linear_slug resolution needed like the HTTP-triggered
//      /generate endpoint has to do).
//   3. Project ids come from Linear itself, not the (possibly stale)
//      customers.linear_projects snapshot column — syncCustomerLinearProjects
//      re-fetches the initiative's live project list from Linear via
//      linear_slug and refreshes that column as a side effect, same helper
//      issues/createIssue.ts and syncLinearProjects.ts already use for this
//      exact staleness problem.
//   One generateSuggestionForProject call per project returned.
export async function handleGenerateAllSuggestions(req: Request): Promise<Response> {
  const schema = "portal";

  // Manual-trigger convenience (like linear-vector-sync's own ?slug=) — scope
  // one run to a single customer instead of every customer in the project.
  const slugParam = new URL(req.url).searchParams.get("slug");

  let customers: { customer_id: string; clientName: string; linear_slug: string }[];
  if (slugParam) {
    const { data, error } = await supabase.schema(schema)
      .from("customers")
      .select("customer_id, clientName, linear_slug")
      .ilike("clientName", escapeIlike(slugParam))
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return Response.json({ error: `No customer found for slug "${slugParam}"` }, { status: 404 });
    }
    customers = [data];
  } else {
    // Only customers actually linked to a Linear initiative can have
    // projects to generate suggestions for.
    const { data, error } = await supabase.schema(schema)
      .from("customers")
      .select("customer_id, clientName, linear_slug")
      .not("linear_slug", "is", null);
    if (error) throw new Error(error.message);
    customers = data ?? [];
  }

  const results: {
    slug: string;
    projectsFound: number;
    created: number;
    skippedPending: number;
    failed: number;
  }[] = [];

  // Same concurrency cap as linear-vector-sync — this fans out to the same
  // shared Linear API + Hugging Face token, not per-customer isolated
  // resources, so more workers just adds contention rather than parallelizing
  // independent work.
  await runWithConcurrency(customers, 2, async (customer) => {
    if (!customer.clientName || !customer.linear_slug) return;
    const slug = customer.clientName.toLowerCase();

    const projectIds = await syncCustomerLinearProjects(customer.customer_id, customer.linear_slug, schema);
    if (!projectIds) {
      console.error(`[generate-all] ${slug}: failed to sync projects from Linear, skipping this run`);
      results.push({ slug, projectsFound: 0, created: 0, skippedPending: 0, failed: 1 });
      return;
    }

    // Skip a project that already has an un-actioned suggestion from a
    // previous run — otherwise a customer who never gets around to
    // accepting/declining ends up with an ever-growing pile of pending
    // cards, one more every week, for the same project.
    const { data: pending, error: pendingError } = await supabase
      .schema(schema)
      .from("suggested_features")
      .select("linear_project_id")
      .eq("project_slug", customer.linear_slug)
      .eq("status", "pending");
    if (pendingError) throw new Error(pendingError.message);
    const projectsWithPending = new Set((pending ?? []).map((r: { linear_project_id: string }) => r.linear_project_id));

    let created = 0;
    let skippedPending = 0;
    let failed = 0;
    for (const projectId of projectIds) {
      if (projectsWithPending.has(projectId)) {
        skippedPending++;
        continue;
      }
      try {
        await generateSuggestionForProject(schema, customer.linear_slug, projectId);
        created++;
      } catch (err) {
        failed++;
        console.error(`[generate-all] ${slug} / ${projectId}: failed to generate suggestion`, err);
      }
    }

    results.push({ slug, projectsFound: projectIds.length, created, skippedPending, failed });
  });

  return Response.json({ success: true, customers: results });
}
