// @ts-nocheck
import { supabase } from "../client.ts";
import { linearRequest } from "../issues/linearClient.ts";
import { escapeIlike } from "../utils/slug.ts";
import { BUCKET, SCHEMA } from "./helpers.ts";

// Frees storage: finds the uploaded demo files of an initiative whose tickets
// are all Done or deleted in Linear, so they can be removed.
//
// A file is only a candidate when *every* demo row pointing at it (a demo can
// be attached to several tickets, all sharing one file) belongs to a Done or
// deleted ticket — a file still used by an open ticket is never touched.
// Link demos (Loom, etc.) take no storage and are ignored.
//
// Tickets permanently purged from Linear (30+ days in trash) no longer come
// back from Linear at all, so their demos can't be tied to the initiative and
// aren't included.

// Every ticket of the given projects, including archived and trashed ones.
const INITIATIVE_ISSUES_QUERY = `
  query InitiativeIssues($filter: IssueFilter, $after: String) {
    issues(first: 250, filter: $filter, after: $after, includeArchived: true) {
      nodes { id identifier title trashed state { name } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

type LinearIssue = { id: string; identifier: string; title: string; trashed?: boolean | null; state?: { name: string } | null };

async function fetchInitiativeIssues(projectIds: string[]): Promise<LinearIssue[]> {
  const issues: LinearIssue[] = [];
  let after: string | null = null;
  do {
    const data = await linearRequest(INITIATIVE_ISSUES_QUERY, {
      filter: { project: { id: { in: projectIds } } },
      after,
    });
    issues.push(...(data.issues?.nodes ?? []));
    after = data.issues?.pageInfo?.hasNextPage ? data.issues.pageInfo.endCursor : null;
  } while (after);
  return issues;
}

// Why a ticket's demos may go: "done" or "deleted"; null keeps them.
function removalReason(issue: LinearIssue): "done" | "deleted" | null {
  if (issue.trashed) return "deleted";
  if (issue.state?.name === "Done") return "done";
  return null;
}

// The initiative by route slug (clientName) or customer id.
async function resolveInitiative({ slug, customerId }: { slug?: string | null; customerId?: string | null }) {
  let query = supabase.schema(SCHEMA).from("customers").select("customer_id, clientName, linear_projects");
  query = customerId ? query.eq("customer_id", customerId) : query.ilike("clientName", escapeIlike(slug ?? ""));
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Sizes of the given files, by path (listed per folder: `{issue}/v{n}/`).
async function fileSizes(paths: string[]): Promise<Map<string, number>> {
  const sizes = new Map<string, number>();
  const byFolder = new Map<string, string[]>();
  for (const path of paths) {
    const folder = path.slice(0, path.lastIndexOf("/"));
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), path]);
  }
  for (const [folder] of byFolder) {
    const { data } = await supabase.storage.from(BUCKET).list(folder, { limit: 1000 });
    for (const obj of data ?? []) {
      sizes.set(`${folder}/${obj.name}`, obj.metadata?.size ?? 0);
    }
  }
  return sizes;
}

export type CleanupPlan = {
  initiative: string;
  files: {
    storagePath: string;
    sizeBytes: number;
    demoIds: string[];
    title: string | null;
    tickets: { issueId: string; identifier: string; title: string; reason: "done" | "deleted" }[];
  }[];
  skippedInUse: number;
  totalFiles: number;
  totalBytes: number;
  demoRows: number;
};

export async function planDemoCleanup(params: { slug?: string | null; customerId?: string | null }): Promise<CleanupPlan | null> {
  const initiative = await resolveInitiative(params);
  if (!initiative) return null;
  const projectIds: string[] = initiative.linear_projects ?? [];

  const issues = projectIds.length ? await fetchInitiativeIssues(projectIds) : [];
  const issueById = new Map(issues.map((i) => [i.id, i]));

  // Uploaded demos on this initiative's tickets.
  const issueIds = issues.map((i) => i.id);
  const demos: any[] = [];
  for (let i = 0; i < issueIds.length; i += 200) {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from("demo_videos")
      .select("id, issue_id, storage_path, title")
      .eq("source_type", "upload")
      .in("issue_id", issueIds.slice(i, i + 200));
    if (error) throw new Error(error.message);
    demos.push(...(data ?? []));
  }

  const paths = [...new Set(demos.map((d) => d.storage_path).filter(Boolean))];

  // Every row that uses each file, across all initiatives — a shared file is
  // only removable if none of its rows is on a ticket that stays.
  const usersOfPath = new Map<string, any[]>();
  for (let i = 0; i < paths.length; i += 200) {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from("demo_videos")
      .select("id, issue_id, storage_path, title")
      .in("storage_path", paths.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      usersOfPath.set(row.storage_path, [...(usersOfPath.get(row.storage_path) ?? []), row]);
    }
  }

  const files: CleanupPlan["files"] = [];
  let skippedInUse = 0;
  for (const path of paths) {
    const rows = usersOfPath.get(path) ?? [];
    const tickets = rows.map((r) => {
      const issue = issueById.get(r.issue_id);
      return issue ? { issue, reason: removalReason(issue) } : { issue: null, reason: null };
    });
    if (rows.length === 0 || tickets.some((t) => !t.reason)) {
      skippedInUse++;
      continue;
    }
    files.push({
      storagePath: path,
      sizeBytes: 0,
      demoIds: rows.map((r) => r.id),
      title: rows.find((r) => r.title)?.title ?? null,
      tickets: tickets.map((t) => ({
        issueId: t.issue!.id,
        identifier: t.issue!.identifier,
        title: t.issue!.title,
        reason: t.reason!,
      })),
    });
  }

  const sizes = await fileSizes(files.map((f) => f.storagePath));
  files.forEach((f) => (f.sizeBytes = sizes.get(f.storagePath) ?? 0));

  return {
    initiative: initiative.clientName,
    files,
    skippedInUse,
    totalFiles: files.length,
    totalBytes: files.reduce((sum, f) => sum + f.sizeBytes, 0),
    demoRows: files.reduce((sum, f) => sum + f.demoIds.length, 0),
  };
}

// Removes the files from storage, then the demo rows that pointed at them
// (their feedback comments go with them via ON DELETE CASCADE). Recomputes
// the plan instead of trusting a list from the caller.
export async function runDemoCleanup(params: { slug?: string | null; customerId?: string | null }) {
  const plan = await planDemoCleanup(params);
  if (!plan) return null;

  const paths = plan.files.map((f) => f.storagePath);
  const demoIds = plan.files.flatMap((f) => f.demoIds);

  const removedPaths: string[] = [];
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { data, error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) throw new Error(`Storage removal failed after ${removedPaths.length} files: ${error.message}`);
    removedPaths.push(...(data ?? []).map((o) => o.name));
  }

  for (let i = 0; i < demoIds.length; i += 200) {
    const { error } = await supabase
      .schema(SCHEMA)
      .from("demo_videos")
      .delete()
      .in("id", demoIds.slice(i, i + 200));
    if (error) throw new Error(`Files removed, but deleting demo rows failed: ${error.message}`);
  }

  return {
    initiative: plan.initiative,
    deletedFiles: paths.length,
    freedBytes: plan.totalBytes,
    deletedDemoRows: demoIds.length,
  };
}
