// @ts-nocheck
import { supabase } from "../client.ts";
import { linearRequest } from "../issues/linearClient.ts";
import { escapeIlike } from "../utils/slug.ts";
import { BUCKET, SCHEMA } from "./helpers.ts";
import {
  DEFAULT_CLEANUP_MODE,
  latestVersionByIssue,
  pickRemovableFiles,
  type CleanupMode,
  type RemovalReason,
} from "./cleanupRules.ts";

// Frees storage: finds the uploaded demo files of an initiative's Done or
// deleted tickets, so they can be removed. Which ones, per mode, is in
// cleanupRules.ts: by default ("keep-latest") a Done ticket keeps its latest
// version; "all" removes every version of Done tickets too. Deleted tickets
// lose all their demos either way.
//
// A file is only a candidate when *every* demo row pointing at it (a demo can
// be attached to several tickets, all sharing one file) may go — a file still
// used by an open ticket, or that is a Done ticket's latest version in
// "keep-latest", is never touched. Link demos (Loom, etc.) take no storage
// and are never removed (they still count as a ticket's latest version).
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
  mode: CleanupMode;
  files: {
    storagePath: string;
    sizeBytes: number;
    demoIds: string[];
    title: string | null;
    tickets: { issueId: string; identifier: string; title: string; version: number; reason: RemovalReason }[];
  }[];
  skippedInUse: number;
  totalFiles: number;
  totalBytes: number;
  demoRows: number;
};

type CleanupParams = { slug?: string | null; customerId?: string | null; mode?: CleanupMode };

export async function planDemoCleanup(params: CleanupParams): Promise<CleanupPlan | null> {
  const mode = params.mode ?? DEFAULT_CLEANUP_MODE;
  const initiative = await resolveInitiative(params);
  if (!initiative) return null;
  const projectIds: string[] = initiative.linear_projects ?? [];

  const issues = projectIds.length ? await fetchInitiativeIssues(projectIds) : [];
  const issueById = new Map(issues.map((i) => [i.id, i]));

  // Every demo version on this initiative's tickets, links included: a link
  // can be a ticket's latest version.
  const issueIds = issues.map((i) => i.id);
  const demos: any[] = [];
  for (let i = 0; i < issueIds.length; i += 200) {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from("demo_videos")
      .select("id, issue_id, version, source_type, storage_path, title")
      .in("issue_id", issueIds.slice(i, i + 200));
    if (error) throw new Error(error.message);
    demos.push(...(data ?? []));
  }
  const latest = latestVersionByIssue(demos);

  // Only uploaded files take storage.
  const paths = [
    ...new Set(demos.filter((d) => d.source_type === "upload").map((d) => d.storage_path).filter(Boolean)),
  ];

  // Every row that uses each file, across all initiatives — a shared file is
  // only removable if none of its rows is on a ticket that stays.
  const usersOfPath = new Map<string, any[]>(paths.map((p) => [p, []]));
  for (let i = 0; i < paths.length; i += 200) {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from("demo_videos")
      .select("id, issue_id, version, storage_path, title")
      .in("storage_path", paths.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      usersOfPath.get(row.storage_path)?.push(row);
    }
  }

  const picked = pickRemovableFiles(usersOfPath, issueById, latest, mode);
  const files: CleanupPlan["files"] = picked.files.map((f) => ({ ...f, sizeBytes: 0 }));
  const skippedInUse = picked.skippedInUse;

  const sizes = await fileSizes(files.map((f) => f.storagePath));
  files.forEach((f) => (f.sizeBytes = sizes.get(f.storagePath) ?? 0));

  return {
    initiative: initiative.clientName,
    mode,
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
export async function runDemoCleanup(params: CleanupParams) {
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
    mode: plan.mode,
    deletedFiles: paths.length,
    freedBytes: plan.totalBytes,
    deletedDemoRows: demoIds.length,
  };
}
