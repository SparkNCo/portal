// Which uploaded demo files the storage cleanup may remove (cleanupDemos.ts).
// Pure logic, no Deno or network imports, so the Node unit tests can load it
// (tests/unit/demo-cleanup.spec.ts).
//
// Modes:
//   "keep-latest" (default): a Done ticket keeps its latest demo version and
//                 loses the older ones; a deleted ticket loses them all.
//   "all":        every demo of a Done or deleted ticket goes.
// Open tickets are never touched. A file can be shared by several demo rows
// (one upload attached to several tickets): it only goes when every row
// using it may go.

export const CLEANUP_MODES = ["keep-latest", "all"] as const;
export type CleanupMode = (typeof CLEANUP_MODES)[number];
export const DEFAULT_CLEANUP_MODE: CleanupMode = "keep-latest";

export function parseCleanupMode(value: string | null | undefined): CleanupMode | null {
  if (value === null || value === undefined || value === "") return DEFAULT_CLEANUP_MODE;
  return (CLEANUP_MODES as readonly string[]).includes(value) ? (value as CleanupMode) : null;
}

export type RemovalReason = "deleted" | "done" | "older-version";

export type CleanupIssue = {
  id: string;
  identifier: string;
  title: string;
  trashed?: boolean | null;
  state?: { name: string } | null;
};

export type CleanupDemoRow = {
  id: string;
  issue_id: string;
  version: number;
  storage_path: string | null;
  title?: string | null;
};

export type RemovableFile = {
  storagePath: string;
  demoIds: string[];
  title: string | null;
  tickets: { issueId: string; identifier: string; title: string; version: number; reason: RemovalReason }[];
};

// The highest version of each ticket, uploads and links alike: a link as the
// latest version still makes the older uploads "older".
export function latestVersionByIssue(rows: { issue_id: string; version: number }[]): Map<string, number> {
  const latest = new Map<string, number>();
  for (const row of rows) {
    if (row.version > (latest.get(row.issue_id) ?? Number.NEGATIVE_INFINITY)) latest.set(row.issue_id, row.version);
  }
  return latest;
}

// Why this demo row may go, or null to keep it. `issue` is undefined for a
// ticket that isn't this initiative's (or was purged from Linear): kept.
export function rowRemovalReason(
  row: CleanupDemoRow,
  issue: CleanupIssue | undefined,
  latest: Map<string, number>,
  mode: CleanupMode,
): RemovalReason | null {
  if (!issue) return null;
  if (issue.trashed) return "deleted";
  if (issue.state?.name !== "Done") return null;
  if (mode === "all") return "done";
  const latestVersion = latest.get(row.issue_id);
  return latestVersion !== undefined && row.version < latestVersion ? "older-version" : null;
}

// `usersOfPath`: every demo row (any initiative) using each file.
export function pickRemovableFiles(
  usersOfPath: Map<string, CleanupDemoRow[]>,
  issueById: Map<string, CleanupIssue>,
  latest: Map<string, number>,
  mode: CleanupMode,
): { files: RemovableFile[]; skippedInUse: number } {
  const files: RemovableFile[] = [];
  let skippedInUse = 0;

  for (const [path, rows] of usersOfPath) {
    const decided = rows.map((row) => {
      const issue = issueById.get(row.issue_id);
      return { row, issue, reason: rowRemovalReason(row, issue, latest, mode) };
    });
    if (decided.length === 0 || decided.some((d) => !d.reason)) {
      skippedInUse++;
      continue;
    }
    files.push({
      storagePath: path,
      demoIds: rows.map((r) => r.id),
      title: rows.find((r) => r.title)?.title ?? null,
      tickets: decided.map((d) => ({
        issueId: d.issue!.id,
        identifier: d.issue!.identifier,
        title: d.issue!.title,
        version: d.row.version,
        reason: d.reason!,
      })),
    });
  }

  return { files, skippedInUse };
}
