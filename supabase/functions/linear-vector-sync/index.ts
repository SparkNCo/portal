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

// Caps how far back a catch-up run will ever look, in case last_synced_at is
// missing or very stale (first run, or a gap after an outage) — NOT a floor
// that widens every normal run. getSinceForCustomer below uses last_synced_at
// directly whenever it's within this many days, so an hourly cron that's
// keeping up only ever re-scans the last ~hour, not this whole window every
// single time. (An earlier version of this comparison was inverted — it
// always returned the wide window even when last_synced_at was recent,
// meaning every hourly run re-scanned a full multi-day backlog forever. That,
// stacked with upsertIssueVector's two-vectors-per-issue change, is what
// tipped Upstash into "vector store backend is currently unavailable"
// rate-limit errors during routine runs, not just real catch-ups.)
const CATCH_UP_CAP_DAYS = 1;
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
// makes trashed issues visible to the query at all.
//
// `trashed` is NOT a filterable field on Linear's `IssueFilter` input type
// (verified against the schema — it only exposes `archivedAt`, no `trashed`
// comparator) even though it IS a real field on the `Issue` *output* type.
// An earlier version of this query filtered by `trashed: { eq: true }`
// directly, which Linear's API rejects as an unknown input field — every
// call threw, which (via runWithConcurrency's Promise.all) failed the
// *entire* batch for *every* customer, so deletions never actually ran, not
// even once, since this feature shipped. Fixed by requesting `trashed` as an
// output field instead and filtering for it in JS below. Reuses the same
// `updatedAt`-since checkpoint as the query above (trashing an issue bumps
// its updatedAt like any other edit) rather than tracking a second cursor.
const TRASHED_ISSUE_IDS_QUERY = `
  query TrashedIssueIds($filter: IssueFilter, $after: String) {
    issues(first: 250, filter: $filter, after: $after, includeArchived: true) {
      nodes { id identifier title trashed }
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
    console.error(`⚠️ getSinceForCustomer: lookup failed for ${linearSlug}, falling back to ${CATCH_UP_CAP_DAYS}d window`, error.message);
  }

  const cap = new Date(Date.now() - CATCH_UP_CAP_DAYS * 24 * 60 * 60 * 1000);
  const lastSynced = data?.last_synced_at ? new Date(data.last_synced_at) : null;

  // Trust the checkpoint whenever it's within the cap (the normal, steady-
  // state case for an hourly cron that's keeping up) — only fall back to the
  // capped window when there's no checkpoint yet, or it's older than the cap
  // (e.g. this customer's sync was broken/paused for longer than that).
  return lastSynced && lastSynced > cap ? lastSynced : cap;
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
    // `includeArchived: true` widens results to everything archived, not
    // just trashed — a lighter "archived but not trashed" issue would
    // otherwise get its vector deleted too, so `trashed` is filtered here
    // in JS against the field requested in the query above rather than in
    // the (nonexistent) IssueFilter comparator.
    const data = await linearRequest(TRASHED_ISSUE_IDS_QUERY, {
      filter: {
        project: { id: { in: projectIds } },
        updatedAt: { gt: since.toISOString() },
      },
      after,
    });
    const nodes = (data.issues?.nodes ?? []) as (TrashedIssue & { trashed?: boolean | null })[];
    trashed.push(...nodes.filter((n) => n.trashed === true));
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

  // upsertIssueVector/deleteIssueVectors are both "best-effort" (they catch
  // their own Upstash errors and never throw — a vector-sync hiccup must
  // never fail the actual issue write elsewhere in the app) but now report
  // back whether they actually succeeded, specifically so this loop can
  // track it: advancing the checkpoint below despite a real write failure
  // would let that issue's `updatedAt` age out of the next run's `since`
  // filter, silently orphaning it in Upstash forever instead of retrying.
  let allWritesSucceeded = true;
  for (const issue of issues) {
    const ok = await upsertIssueVector(linear_slug, {
      id: issue.id,
      title: issue.title,
      description: issue.description,
      kind: deriveIssueKind(issue.labels?.nodes),
    });
    if (!ok) allWritesSucceeded = false;
  }

  // Cleans up vectors for tickets deleted directly in Linear since the last
  // checkpoint — see this file's own TRASHED_ISSUE_IDS_QUERY comment for why
  // this is a separate query rather than something the update-sync above
  // already catches. The Linear-query half is wrapped in its own try/catch:
  // runWithConcurrency's Promise.all fails the *entire* batch (every
  // customer) the instant any one call throws (exactly what silently broke
  // this for every customer for a while — see TRASHED_ISSUE_IDS_QUERY's
  // comment), so a problem here must never take down the update-sync above
  // or another customer's run.
  let trashedCount = 0;
  try {
    const trashed = await fetchTrashedIssues(linear_projects, since);
    if (trashed.length > 0) {
      console.log(
        `[linear-vector-sync] ${linear_slug}: deleting vectors for ` +
          trashed.map((t) => `${t.identifier} (${t.title})`).join(", "),
      );
    }
    const deleted = await deleteIssueVectors(linear_slug, trashed.map((t) => t.id));
    if (!deleted) allWritesSucceeded = false;
    trashedCount = trashed.length;
  } catch (err) {
    allWritesSucceeded = false;
    console.error(`[linear-vector-sync] ${linear_slug}: trash cleanup failed (non-fatal):`, err);
  }

  if (allWritesSucceeded) {
    await supabase.schema(SCHEMA)
      .from("vector_sync_state")
      .upsert(
        { linear_slug, last_synced_at: syncStartedAt.toISOString() },
        { onConflict: "linear_slug" },
      );
  } else {
    console.warn(
      `[linear-vector-sync] ${linear_slug}: checkpoint NOT advanced (at least one write failed) — this window will be retried next run`,
    );
  }

  console.log(
    `[linear-vector-sync] ${linear_slug}: synced ${issues.length} issue(s), ` +
      `removed ${trashedCount} trashed vector(s) since ${since.toISOString()}`,
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

    // Lowered from 3 → 2: Upstash is one shared vector store behind every
    // customer's namespace, not a per-customer resource, so this concurrency
    // adds directly to Upstash's load rather than parallelizing independent
    // work. Paired with upsertIssueVector's now-sequential (not Promise.all)
    // pair of upserts per issue as the other lever against the "vector store
    // backend is currently unavailable" throttling seen during catch-up runs.
    await runWithConcurrency(customers, 2, (customer) => syncCustomer(customer, syncStartedAt));

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
