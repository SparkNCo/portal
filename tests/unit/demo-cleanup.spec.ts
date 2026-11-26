import { test, expect } from '@playwright/test';
import {
  DEFAULT_CLEANUP_MODE,
  latestVersionByIssue,
  parseCleanupMode,
  pickRemovableFiles,
  type CleanupDemoRow,
  type CleanupIssue,
  type CleanupMode,
} from '../../supabase/functions/demo-videos/cleanupRules';

// Demo storage cleanup: which uploaded files may be removed
// (supabase/functions/demo-videos/cleanupRules.ts). Pure logic — no Linear, no storage.

const issue = (id: string, state: string, trashed = false): CleanupIssue => ({
  id,
  identifier: id.toUpperCase(),
  title: `Ticket ${id}`,
  state: { name: state },
  trashed,
});
const row = (id: string, issueId: string, version: number, path: string | null = `${issueId}/v${version}/f.mp4`): CleanupDemoRow => ({
  id,
  issue_id: issueId,
  version,
  storage_path: path,
  title: null,
});

// Runs the rules: `rows` are the initiative's demo versions (links have a null
// path), files are grouped by path as cleanupDemos.ts does.
function removable(rows: CleanupDemoRow[], issues: CleanupIssue[], mode: CleanupMode, extraUsers: CleanupDemoRow[] = []) {
  const usersOfPath = new Map<string, CleanupDemoRow[]>();
  for (const r of [...rows, ...extraUsers]) {
    if (!r.storage_path) continue;
    usersOfPath.set(r.storage_path, [...(usersOfPath.get(r.storage_path) ?? []), r]);
  }
  const result = pickRemovableFiles(usersOfPath, new Map(issues.map((i) => [i.id, i])), latestVersionByIssue(rows), mode);
  return { paths: result.files.map((f) => f.storagePath).sort(), skippedInUse: result.skippedInUse, files: result.files };
}

test.describe('parseCleanupMode', () => {
  test('keep-latest by default; all on request; anything else is rejected', () => {
    expect(DEFAULT_CLEANUP_MODE).toBe('keep-latest');
    expect(parseCleanupMode(null)).toBe('keep-latest');
    expect(parseCleanupMode('')).toBe('keep-latest');
    expect(parseCleanupMode('all')).toBe('all');
    expect(parseCleanupMode('keep-latest')).toBe('keep-latest');
    expect(parseCleanupMode('everything')).toBeNull();
  });
});

test.describe('keep-latest', () => {
  test('a Done ticket keeps its latest version and loses the older ones', () => {
    const rows = [row('a1', 'a', 1), row('a2', 'a', 2), row('a3', 'a', 3)];
    const { paths, files } = removable(rows, [issue('a', 'Done')], 'keep-latest');
    expect(paths).toEqual(['a/v1/f.mp4', 'a/v2/f.mp4']);
    expect(files[0]!.tickets[0]!.reason).toBe('older-version');
  });

  test('a Done ticket with a single version keeps it', () => {
    expect(removable([row('a1', 'a', 1)], [issue('a', 'Done')], 'keep-latest').paths).toEqual([]);
  });

  test('when the latest version is a link, every older upload goes', () => {
    const rows = [row('a1', 'a', 1), row('a2', 'a', 2), row('a3', 'a', 3, null)];
    expect(removable(rows, [issue('a', 'Done')], 'keep-latest').paths).toEqual(['a/v1/f.mp4', 'a/v2/f.mp4']);
  });

  test('a deleted ticket loses every version, the latest too', () => {
    const rows = [row('a1', 'a', 1), row('a2', 'a', 2)];
    const { paths, files } = removable(rows, [issue('a', 'In Progress', true)], 'keep-latest');
    expect(paths).toEqual(['a/v1/f.mp4', 'a/v2/f.mp4']);
    expect(files.every((f) => f.tickets[0]!.reason === 'deleted')).toBe(true);
  });

  test('an open ticket keeps everything', () => {
    const rows = [row('a1', 'a', 1), row('a2', 'a', 2)];
    expect(removable(rows, [issue('a', 'QA')], 'keep-latest').paths).toEqual([]);
  });

  test("a shared file stays when it's another Done ticket's latest version", () => {
    // One upload: ticket a's v1 (old) and ticket b's v1 (its latest).
    const shared = 'shared/v1/f.mp4';
    const rows = [row('a1', 'a', 1, shared), row('a2', 'a', 2), row('b1', 'b', 1, shared)];
    const { paths, skippedInUse } = removable(rows, [issue('a', 'Done'), issue('b', 'Done')], 'keep-latest');
    expect(paths).toEqual([]);
    expect(skippedInUse).toBe(2);
  });

  test('a shared file goes when it is an older version for every ticket using it', () => {
    const shared = 'shared/v1/f.mp4';
    const rows = [row('a1', 'a', 1, shared), row('a2', 'a', 2), row('b1', 'b', 1, shared), row('b2', 'b', 2)];
    const { files } = removable(rows, [issue('a', 'Done'), issue('b', 'Done')], 'keep-latest');
    const file = files.find((f) => f.storagePath === shared)!;
    expect(file.demoIds.sort()).toEqual(['a1', 'b1']);
  });

  test("a file also used by another initiative's ticket stays", () => {
    const rows = [row('a1', 'a', 1), row('a2', 'a', 2)];
    const elsewhere = row('z1', 'z', 1, 'a/v1/f.mp4');
    expect(removable(rows, [issue('a', 'Done')], 'keep-latest', [elsewhere]).paths).toEqual([]);
  });
});

test.describe('all', () => {
  test('every version of a Done ticket goes, the latest too', () => {
    const rows = [row('a1', 'a', 1), row('a2', 'a', 2)];
    const { paths, files } = removable(rows, [issue('a', 'Done')], 'all');
    expect(paths).toEqual(['a/v1/f.mp4', 'a/v2/f.mp4']);
    expect(files.every((f) => f.tickets[0]!.reason === 'done')).toBe(true);
  });

  test('open tickets are still never touched', () => {
    expect(removable([row('a1', 'a', 1)], [issue('a', 'Development')], 'all').paths).toEqual([]);
  });
});
