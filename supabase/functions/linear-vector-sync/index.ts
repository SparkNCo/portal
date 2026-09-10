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
import { upsertIssueVector, deleteIssueVectors, deriveIssueKind } from "../lib/vector.ts";

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

// Linear soft-deletes ("trash") rather than actually removing an issue, so a
// deleted ticket just silently stops showing up in the query above — normal
// `issues` results exclude trashed items by default, and nothing tells this
// sync to go clean up its now-stale vector. `includeArchived: true` is what
// makes trashed issues visible to the query at all; `trashed: { eq: true }`
// then narrows to just those. Reuses the same `updatedAt`-since checkpoint
// as the query above (trashing an issue bumps its updatedAt like any other
// edit) rather than tracking a second cursor.
const TRASHED_ISSUE_IDS_QUERY = `
  query TrashedIssueIds($filter: IssueFilter, $after: String) {
    issues(first: 250, filter: $filter, after: $after, includeArchived: true) {
      nodes { id identifier title }
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

type TrashedIssue = { id: string; identifier: string; title: string };

// Returns identifier/title alongside id — never needed by the actual
// Upstash delete call (that only takes ids), but logged before deleting so
// a manual test run (or anyone reading the logs) can visually confirm
// "yes, SPA-123 is what's being removed" instead of trusting a bare UUID.
async function fetchTrashedIssues(projectIds: string[], since: Date): Promise<TrashedIssue[]> {
  const trashed: TrashedIssue[] = [];
  let after: string | undefined;

  do {
    const data = await linearRequest(TRASHED_ISSUE_IDS_QUERY, {
      filter: {
        project: { id: { in: projectIds } },
        trashed: { eq: true },
        updatedAt: { gt: since.toISOString() },
      },
      after,
    });
    trashed.push(...(data.issues?.nodes ?? []));
    const pageInfo = data.issues?.pageInfo;
    after = pageInfo?.hasNextPage ? pageInfo.endCursor : undefined;
  } while (after);

  return trashed;
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

  // Cleans up vectors for tickets deleted directly in Linear since the last
  // checkpoint — see this file's own TRASHED_ISSUE_IDS_QUERY comment for why
  // this is a separate query rather than something the update-sync above
  // already catches.
  const trashed = await fetchTrashedIssues(linear_projects, since);
  if (trashed.length > 0) {
    console.log(
      `[linear-vector-sync] ${linear_slug}: deleting vectors for ` +
        trashed.map((t) => `${t.identifier} (${t.title})`).join(", "),
    );
  }
  await deleteIssueVectors(linear_slug, trashed.map((t) => t.id));

  await supabase.schema(SCHEMA)
    .from("vector_sync_state")
    .upsert(
      { linear_slug, last_synced_at: syncStartedAt.toISOString() },
      { onConflict: "linear_slug" },
    );

  console.log(
    `[linear-vector-sync] ${linear_slug}: synced ${issues.length} issue(s), ` +
      `removed ${trashed.length} trashed vector(s) since ${since.toISOString()}`,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Captured before querying Linear so an issue edited mid-run just gets picked up
    // again next run, rather than risking a gap from using "last issue's updatedAt".
    const syncStartedAt = new Date();

    // The cron itself never sends this — it's a manual-trigger convenience
    // (e.g. from Insomnia while testing) to scope one run to a single
    // customer by clientName instead of every customer in the project.
    const slug = new URL(req.url).searchParams.get("slug");
    let customers;
    if (slug) {
      const { data, error } = await supabase.schema(SCHEMA)
        .from("customers")
        .select("customer_id, linear_projects, linear_slug, project_url")
        .ilike("clientName", escapeIlike(slug))
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) {
        return new Response(JSON.stringify({ error: `No customer found for slug "${slug}"` }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      customers = [data];
    } else {
      customers = await getAllCustomers(SCHEMA);
    }

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
