// @ts-nocheck
// Cron target (..._schedule_linear_vector_sync_cron.sql). Catches issue edits made
// directly in Linear (edits made in-app already upsert on save): upserts each
// customer's issues updated since their checkpoint, and removes trashed ones.
//
// Manual: ?slug={clientName} scopes to one customer; add &full=true to backfill
// every issue that has no up-to-date vector (MAX_ISSUES_PER_RUN per call — call
// again until the response's `remaining` is 0).
import { corsHeaders } from "../utils/headers.ts";
import { supabase } from "../client.ts";
import { getAllCustomers } from "../issueMetrics/db.ts";
import { linearRequest } from "../issues/linearClient.ts";
import { runWithConcurrency } from "../utils/concurrency.ts";
import { escapeIlike } from "../utils/slug.ts";
import { upsertIssueVector, deleteIssueVectors, deriveIssueKind } from "../lib/vector.ts";

// Max look-back when last_synced_at is missing or older than this (first run,
// outage). A cron that's keeping up only re-scans since its checkpoint.
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

// Deleted Linear issues are soft-deleted ("trashed") and excluded from normal
// queries; `includeArchived: true` makes them visible. `trashed` can't be used
// in IssueFilter (Linear rejects it as an unknown input field), so it's
// requested as an output field and filtered in JS. Trashing bumps updatedAt,
// so the same checkpoint works here.
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

// identifier/title are only for readable logs; the delete itself only needs ids.
async function fetchTrashedIssues(projectIds: string[], since: Date): Promise<TrashedIssue[]> {
  const trashed: TrashedIssue[] = [];
  let after: string | undefined;

  do {
    // includeArchived also returns archived-but-not-trashed issues — those
    // must keep their vectors, hence the `trashed === true` filter below.
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

// id → updated_at of every stored issue vector for this customer, so a full
// backfill can skip issues already embedded since their last Linear edit.
async function fetchStoredVectorTimes(linearSlug: string): Promise<Map<string, number>> {
  const PAGE = 1000;
  const times = new Map<string, number>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.schema(SCHEMA)
      .from("issue_vectors")
      .select("id, updated_at")
      .ilike("project_slug", escapeIlike(linearSlug))
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) times.set(row.id, new Date(row.updated_at).getTime());
    if (!data || data.length < PAGE) break;
  }
  return times;
}

// Full backfill: keeps only issues with no vector, or one older than their
// last edit — so repeated calls keep moving forward instead of redoing the
// oldest batch every time.
async function withoutFreshVectors(linearSlug: string, issues: any[]) {
  const stored = await fetchStoredVectorTimes(linearSlug);
  return issues.filter((issue) => {
    const storedAt = stored.get(issue.id);
    return storedAt === undefined || storedAt < new Date(issue.updatedAt).getTime();
  });
}

async function syncCustomer(
  customer: { linear_slug: string; linear_projects: string[] },
  syncStartedAt: Date,
  // ?full=true: ignore the checkpoint and re-scan every issue (backfill).
  full = false,
) {
  const { linear_slug, linear_projects } = customer;
  if (!linear_slug || !linear_projects?.length) return;

  const since = full ? new Date(0) : await getSinceForCustomer(linear_slug);
  const fetched = await fetchIssuesUpdatedSince(linear_projects, since);
  const allIssues = full ? await withoutFreshVectors(linear_slug, fetched) : fetched;

  // Embedding is CPU-heavy (pgvector runs gte-small in-process); a large batch
  // exceeds the function's CPU budget (WORKER_RESOURCE_LIMIT). Process the
  // oldest N per run; the checkpoint below resumes from there next run.
  const MAX_ISSUES_PER_RUN = 30;
  const sortedIssues = [...allIssues].sort(
    (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
  );
  const issues = sortedIssues.slice(0, MAX_ISSUES_PER_RUN);
  const truncated = sortedIssues.length > issues.length;
  if (truncated) {
    console.warn(
      `[linear-vector-sync] ${linear_slug}: ${sortedIssues.length} issues pending, processing oldest ${issues.length} this run`,
    );
  }

  // Any failed write blocks the checkpoint from advancing, so the window is
  // retried instead of the issue aging out of `since` forever.
  let allWritesSucceeded = true;
  let upserted = 0;
  for (const issue of issues) {
    const ok = await upsertIssueVector(linear_slug, {
      id: issue.id,
      title: issue.title,
      description: issue.description,
      kind: deriveIssueKind(issue.labels?.nodes),
    });
    if (ok) {
      upserted++;
    } else {
      allWritesSucceeded = false;
    }
  }

  // Own try/catch: runWithConcurrency uses Promise.all, so a throw here
  // would fail every customer's run, not just this one.
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

  // Truncated run: checkpoint = last processed issue's updatedAt (the `gt`
  // filter excludes it next run). Otherwise, the run's start time.
  const lastProcessed = issues.at(-1);
  const nextCheckpoint = truncated && lastProcessed ? new Date(lastProcessed.updatedAt) : syncStartedAt;

  // A full backfill ignores the checkpoint, so it leaves it alone too.
  if (!full && allWritesSucceeded) {
    await supabase.schema(SCHEMA)
      .from("vector_sync_state")
      .upsert(
        { linear_slug, last_synced_at: nextCheckpoint.toISOString() },
        { onConflict: "linear_slug" },
      );
  } else if (!full) {
    console.warn(
      `[linear-vector-sync] ${linear_slug}: checkpoint NOT advanced (at least one write failed) — this window will be retried next run`,
    );
  }

  console.log(
    `[linear-vector-sync] ${linear_slug}: synced ${issues.length}/${sortedIssues.length} issue(s), ` +
      `removed ${trashedCount} trashed vector(s) since ${since.toISOString()}` +
      (truncated ? ` (truncated — ${sortedIssues.length - issues.length} left for next run)` : ""),
  );

  // `remaining` counts failed writes too — they're retried on the next call.
  return { slug: linear_slug, synced: upserted, remaining: sortedIssues.length - upserted };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Captured before querying Linear so issues edited mid-run are picked up next run.
    const syncStartedAt = new Date();

    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    // Only allowed with `slug` — a full re-scan of every customer is too heavy on Linear.
    const full = url.searchParams.get("full") === "true" && !!slug;
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

    // Kept at 2: embedding runs in-process, so every worker shares this
    // invocation's CPU budget.
    const results: { slug: string; synced: number; remaining: number }[] = [];
    await runWithConcurrency(customers, 2, async (customer) => {
      const result = await syncCustomer(customer, syncStartedAt, full);
      if (result) results.push(result);
    });
    const remaining = results.reduce((sum, r) => sum + r.remaining, 0);

    return new Response(JSON.stringify({ success: true, customersProcessed: customers.length, full, remaining, results }), {
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
