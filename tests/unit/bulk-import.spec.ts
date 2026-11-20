import { test, expect } from '@playwright/test';
import {
  BULK_IMPORT_SCHEMA,
  MAX_DRAFTS,
  buildBulkImportPrompt,
  sanitizeDrafts,
  type BulkProject,
} from '../../supabase/functions/suggested-features/bulkImportPrompt';
import {
  BULK_IMPORT_TTL_MS,
  INTERRUPTED_ERROR,
  buildBulkDescription,
  parseSavedBulkImport,
} from '../../lib/bulk-import-api';

// Bulk import: pasted notes → draft tickets (suggested-features/bulkImportPrompt.ts)
// and the description a draft is filed with (lib/bulk-import-api.ts).
// Pure logic — no model, no Linear.

const projects: BulkProject[] = [
  { id: 'p-web', name: 'Web app', milestones: [{ id: 'm-beta', name: 'Beta' }] },
  { id: 'p-mobile', name: 'Mobile', milestones: [{ id: 'm-launch', name: 'Launch' }] },
];

const ticket = (overrides: Record<string, unknown> = {}) => ({
  type: 'feature',
  title: 'Filter dashboard by region',
  description: 'Users want to see one region at a time.',
  items: ['A region dropdown on the dashboard'],
  expected: '',
  actual: '',
  projectId: 'p-web',
  milestoneId: 'm-beta',
  priority: 'medium',
  sourceExcerpt: 'would be great to filter by region',
  ...overrides,
});

test.describe('buildBulkImportPrompt', () => {
  test('lists every project with its milestones, and the notes inside <notes>', () => {
    const prompt = buildBulkImportPrompt('login is slow on mobile', projects);
    expect(prompt).toContain('project id: p-web | name: Web app');
    expect(prompt).toContain('milestone id: m-launch | name: Launch');
    expect(prompt).toContain('<notes>\nlogin is slow on mobile\n</notes>');
  });

  test('says so when there are no projects or milestones', () => {
    expect(buildBulkImportPrompt('notes', [])).toContain('(no open projects)');
    expect(buildBulkImportPrompt('notes', [{ id: 'p', name: 'P', milestones: [] }])).toContain('(no milestones)');
  });
});

test.describe('BULK_IMPORT_SCHEMA', () => {
  test('strict mode: every property is required', () => {
    const item = BULK_IMPORT_SCHEMA.schema.properties.tickets.items;
    expect([...item.required].sort()).toEqual(Object.keys(item.properties).sort());
    expect(item.additionalProperties).toBe(false);
  });
});

test.describe('sanitizeDrafts', () => {
  test('keeps a valid ticket as is', () => {
    expect(sanitizeDrafts({ tickets: [ticket()] }, projects)).toEqual([
      {
        type: 'feature',
        title: 'Filter dashboard by region',
        description: 'Users want to see one region at a time.',
        items: ['A region dropdown on the dashboard'],
        expected: '',
        actual: '',
        projectId: 'p-web',
        milestoneId: 'm-beta',
        priority: 'medium',
        sourceExcerpt: 'would be great to filter by region',
      },
    ]);
  });

  test('an unknown project id becomes null, and its milestone with it', () => {
    const draft = sanitizeDrafts({ tickets: [ticket({ projectId: 'made-up' })] }, projects)[0]!;
    expect(draft.projectId).toBeNull();
    expect(draft.milestoneId).toBeNull();
  });

  test("a milestone from another project is dropped (the project stays)", () => {
    const draft = sanitizeDrafts({ tickets: [ticket({ milestoneId: 'm-launch' })] }, projects)[0]!;
    expect(draft.projectId).toBe('p-web');
    expect(draft.milestoneId).toBeNull();
  });

  test('unknown type and priority fall back to feature / medium', () => {
    const draft = sanitizeDrafts({ tickets: [ticket({ type: 'chore', priority: 'asap' })] }, projects)[0]!;
    expect(draft.type).toBe('feature');
    expect(draft.priority).toBe('medium');
  });

  test('expected / actual are kept for bugs only', () => {
    const fields = { expected: 'It downloads', actual: 'Nothing happens' };
    const bug = sanitizeDrafts({ tickets: [ticket({ type: 'bug', ...fields })] }, projects)[0]!;
    const feature = sanitizeDrafts({ tickets: [ticket(fields)] }, projects)[0]!;
    expect(bug).toMatchObject(fields);
    expect(feature).toMatchObject({ expected: '', actual: '' });
  });

  test('drops tickets without a title, trims text and empty items', () => {
    const drafts = sanitizeDrafts(
      { tickets: [ticket({ title: '   ' }), ticket({ title: '  Export PDF  ', items: [' a ', '', '  '] }), null, 'x'] },
      projects,
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.title).toBe('Export PDF');
    expect(drafts[0]!.items).toEqual(['a']);
  });

  test(`caps the list at ${MAX_DRAFTS} tickets`, () => {
    const many = Array.from({ length: MAX_DRAFTS + 5 }, (_, i) => ticket({ title: `T${i}` }));
    expect(sanitizeDrafts({ tickets: many }, projects)).toHaveLength(MAX_DRAFTS);
  });

  test('anything that is not { tickets: [...] } gives no drafts', () => {
    expect(sanitizeDrafts(null, projects)).toEqual([]);
    expect(sanitizeDrafts({ tickets: 'nope' }, projects)).toEqual([]);
  });
});

test.describe('buildBulkDescription', () => {
  test('feature: description, criteria and the notes it came from', () => {
    expect(
      buildBulkDescription({
        type: 'feature',
        description: 'See one region at a time.',
        items: ['Region dropdown', ' '],
        expected: '',
        actual: '',
        sourceExcerpt: 'filter by region\nplease',
      }),
    ).toBe(
      '### Feature Description\nSee one region at a time.\n\n### Criteria\n- Region dropdown\n\n### From the notes\n> filter by region\n> please',
    );
  });

  test('bug: same sections as the Bug Report panel, with a description first', () => {
    expect(
      buildBulkDescription({
        type: 'bug',
        description: 'Export does nothing.',
        items: ['Open a report', 'Click Export'],
        expected: 'A PDF downloads',
        actual: 'Nothing happens',
        sourceExcerpt: '',
      }),
    ).toBe(
      '### Description\nExport does nothing.\n\n### Steps to Reproduce\n1. Open a report\n2. Click Export\n\n### Expected Behavior\nA PDF downloads\n\n### Actual Behavior\nNothing happens',
    );
  });
});

test.describe('parseSavedBulkImport', () => {
  const now = 1_800_000_000_000;
  const row = (status: string) => ({ key: status, status, title: 'T' });
  const saved = (overrides: Record<string, unknown> = {}) =>
    JSON.stringify({ notes: 'notes', step: 'review', rows: [row('idle')], index: 0, savedAt: now - 1000, ...overrides });

  test('brings back the notes, drafts, step and position', () => {
    expect(parseSavedBulkImport(saved({ rows: [row('idle'), row('created')], index: 1 }), now)).toEqual({
      notes: 'notes',
      step: 'review',
      rows: [row('idle'), row('created')],
      index: 1,
      savedAt: now - 1000,
    });
  });

  test('a ticket that was mid-creation comes back as failed, with a warning', () => {
    const restored = parseSavedBulkImport(saved({ rows: [row('creating')] }), now)!;
    expect(restored.rows[0]).toMatchObject({ status: 'failed', error: INTERRUPTED_ERROR });
  });

  test('nothing usable: missing, expired, from the future, malformed', () => {
    expect(parseSavedBulkImport(null, now)).toBeNull();
    expect(parseSavedBulkImport(saved({ savedAt: now - BULK_IMPORT_TTL_MS - 1 }), now)).toBeNull();
    expect(parseSavedBulkImport(saved({ savedAt: now + 60_000 }), now)).toBeNull();
    expect(parseSavedBulkImport('{not json', now)).toBeNull();
    expect(parseSavedBulkImport(saved({ rows: 'x' }), now)).toBeNull();
  });

  test('the position is kept inside the list, and review without drafts goes back to the notes', () => {
    expect(parseSavedBulkImport(saved({ index: 9 }), now)!.index).toBe(0);
    expect(parseSavedBulkImport(saved({ rows: [], index: 3 }), now)).toMatchObject({ step: 'paste', index: 0 });
  });
});
