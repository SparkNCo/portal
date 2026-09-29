// @ts-nocheck
import { supabase } from "../client.ts";
import { syncCustomerLinearProjects } from "../issues/syncLinearProjects.ts";
import { runWithConcurrency } from "../utils/concurrency.ts";
import { escapeIlike } from "../utils/slug.ts";
import { generateSuggestionForProject } from "./generateSuggestion.ts";

// POST /suggested-features/generate-all — weekly cron target
// (..._schedule_suggested_features_cron.sql). One suggestion per project per
// customer. Project ids come live from Linear (syncCustomerLinearProjects),
// not the possibly stale customers.linear_projects snapshot.
export async function handleGenerateAllSuggestions(req: Request): Promise<Response> {
  const schema = "portal";

  // Manual: ?slug= scopes the run to one customer.
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

  // Low cap: all customers share the same Linear API and AI provider quota.
  await runWithConcurrency(customers, 2, async (customer) => {
    if (!customer.clientName || !customer.linear_slug) return;
    const slug = customer.clientName.toLowerCase();

    const projectIds = await syncCustomerLinearProjects(customer.customer_id, customer.linear_slug, schema);
    if (!projectIds) {
      console.error(`[generate-all] ${slug}: failed to sync projects from Linear, skipping this run`);
      results.push({ slug, projectsFound: 0, created: 0, skippedPending: 0, failed: 1 });
      return;
    }

    // Skip projects with a pending suggestion, so ignored cards don't pile up weekly.
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
