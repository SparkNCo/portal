// @ts-nocheck
// Cron target (see supabase/migrations/..._schedule_linear_vector_sync_cron.sql):
// catches issue edits made directly in Linear (not through this app, which already
// upserts inline on save — see issues/updateIsste.ts's handleUpdateIssue). Pulls each
// customer's issues updated since their last checkpoint and upserts them into the
// Upstash issues vector index, namespaced by linear_slug.
import { corsHeaders } from "../utils/headers.ts";
import { supabase } from "../client.ts";
import { getAllCustomers } from "../issueMetrics/db.ts";
import { linearRequest } from "../issues/linearClient.ts";
import { runWithConcurrency } from "../utils/concurrency.ts";
import { escapeIlike } from "../utils/slug.ts";
import { upsertIssueVector, deriveIssueKind } from "../lib/vector.ts";

// Same self-healing-minimum-lookback idea as dora/index.ts's getSinceForCustomer, just
// with a shallower floor — issue text drifting out of the search index for a few days
// is much lower-stakes than dora's metrics history, so this doesn't need 90 days.
const MIN_LOOKBACK_DAYS = 7;
const SCHEMA = "portal";

const ISSUES_UPDATED_SINCE_QUERY = `
  query IssuesUpdatedSince($filter: IssueFilter, $after: String) {
    issues(first: 250, filter: $filter, after: $after) {
      nodes { id title description updatedAt labels { nodes { name } } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

async function getSinceForCustomer(linearSlug: string): Promise<Date> {
  const { data, error } = await supabase.schema(SCHEMA)
    .from("vector_sync_state")
    .select("last_synced_at")
    .ilike("linear_slug", escapeIlike(linearSlug))
    .maybeSingle();

  if (error) {
    console.error(`⚠️ getSinceForCustomer: lookup failed for ${linearSlug}, falling back to ${MIN_LOOKBACK_DAYS}d window`, error.message);
  }

  const minLookback = new Date(Date.now() - MIN_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const lastSynced = data?.last_synced_at ? new Date(data.last_synced_at) : null;

  return lastSynced && lastSynced < minLookback ? lastSynced : minLookback;
}

async function fetchIssuesUpdatedSince(projectIds: string[], since: Date) {
  const nodes: any[] = [];
  let after: string | undefined;

  do {
    const data = await linearRequest(ISSUES_UPDATED_SINCE_QUERY, {
      filter: {
        project: { id: { in: projectIds } },
        updatedAt: { gt: since.toISOString() },
      },
      after,
    });
    nodes.push(...(data.issues?.nodes ?? []));
    const pageInfo = data.issues?.pageInfo;
    after = pageInfo?.hasNextPage ? pageInfo.endCursor : undefined;
  } while (after);

  return nodes;
}

async function syncCustomer(customer: { linear_slug: string; linear_projects: string[] }, syncStartedAt: Date) {
  const { linear_slug, linear_projects } = customer;
  if (!linear_slug || !linear_projects?.length) return;

  const since = await getSinceForCustomer(linear_slug);
  const issues = await fetchIssuesUpdatedSince(linear_projects, since);

  for (const issue of issues) {
    await upsertIssueVector(linear_slug, {
      id: issue.id,
      title: issue.title,
      description: issue.description,
      kind: deriveIssueKind(issue.labels?.nodes),
    });
  }

  await supabase.schema(SCHEMA)
    .from("vector_sync_state")
    .upsert(
      { linear_slug, last_synced_at: syncStartedAt.toISOString() },
      { onConflict: "linear_slug" },
    );

  console.log(`[linear-vector-sync] ${linear_slug}: synced ${issues.length} issue(s) since ${since.toISOString()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Captured before querying Linear so an issue edited mid-run just gets picked up
    // again next run, rather than risking a gap from using "last issue's updatedAt".
    const syncStartedAt = new Date();
    const customers = await getAllCustomers(SCHEMA);

    await runWithConcurrency(customers, 3, (customer) => syncCustomer(customer, syncStartedAt));

    return new Response(JSON.stringify({ success: true, customersProcessed: customers.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[linear-vector-sync] Error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
