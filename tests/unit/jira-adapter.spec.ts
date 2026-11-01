import { test, expect } from '@playwright/test';
import { adfToMarkdown, markdownToAdf } from '../../supabase/functions/lib/tickets/jira/adf';
import { jiraCategoryOf, pickTransition, portalStateName } from '../../supabase/functions/lib/tickets/jira/status';
import { isEpic, mapIssue, sprintToCycle, typeLabel } from '../../supabase/functions/lib/tickets/jira/map';

// Jira adapter pure logic: ADF ↔ Markdown, status mapping, issue mapping.

const CUSTOMER = '6f1c2b3a-1111-4222-8333-944455556666';
const ctx = { customerId: CUSTOMER, baseUrl: 'https://acme.atlassian.net', sprintField: 'customfield_10020', storyPointFields: ['customfield_10016'] };

test.describe('ADF ↔ Markdown', () => {
  test('Markdown round-trips through ADF for the common blocks', () => {
    const md = [
      '# Title',
      'Some **bold**, *italic*, `code` and a [link](https://x.dev).',
      '- one\n- two',
      '1. first\n2. second',
      '```ts\nconst a = 1;\n```',
      '> quoted',
    ].join('\n\n');
    expect(adfToMarkdown(markdownToAdf(md))).toBe(md);
  });

  test('line breaks inside a paragraph are kept', () => {
    expect(adfToMarkdown(markdownToAdf('line one\nline two'))).toBe('line one\nline two');
  });

  test('empty or missing content', () => {
    expect(markdownToAdf('')).toEqual({ type: 'doc', version: 1, content: [] });
    expect(adfToMarkdown(null)).toBe('');
    expect(adfToMarkdown('already text')).toBe('already text');
  });

  test('unknown ADF nodes degrade to their text', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'panel', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Heads up' }, { type: 'mention', attrs: { text: '@Ana' } }] }] }],
    };
    expect(adfToMarkdown(doc)).toBe('Heads up@Ana');
  });
});

test.describe('Jira status → portal state', () => {
  test('same-name statuses are those portal states, case-insensitive and with synonyms', () => {
    expect(portalStateName({ name: 'Business Review', statusCategory: { key: 'indeterminate' } })).toBe('Business Review');
    expect(portalStateName({ name: 'uat', statusCategory: { key: 'indeterminate' } })).toBe('UAT');
    expect(portalStateName({ name: 'Code Review', statusCategory: { key: 'indeterminate' } })).toBe('In Review');
    expect(portalStateName({ name: "Won't Do", statusCategory: { key: 'done' } })).toBe('Canceled');
  });

  test('anything else goes by category — whatever the language', () => {
    expect(portalStateName({ name: 'Por hacer', statusCategory: { key: 'new' } })).toBe('Backlog');
    expect(portalStateName({ name: 'En curso', statusCategory: { key: 'indeterminate' } })).toBe('Development');
    expect(portalStateName({ name: 'Listo', statusCategory: { key: 'done' } })).toBe('Done');
    expect(portalStateName(null)).toBe('Backlog');
  });

  test('a transition by name first, then by category', () => {
    const transitions = [
      { id: '11', to: { name: 'Por hacer', statusCategory: { key: 'new' } } },
      { id: '21', to: { name: 'En curso', statusCategory: { key: 'indeterminate' } } },
      { id: '31', to: { name: 'Listo', statusCategory: { key: 'done' } } },
      { id: '41', to: { name: 'UAT', statusCategory: { key: 'indeterminate' } } },
    ];
    expect(pickTransition(transitions, 'UAT')?.id).toBe('41');
    expect(pickTransition(transitions, 'Development')?.id).toBe('21');
    expect(pickTransition(transitions, 'QA')?.id).toBe('21');
    expect(pickTransition(transitions, 'Done')?.id).toBe('31');
    expect(pickTransition(transitions, 'Backlog')?.id).toBe('11');
    expect(pickTransition([], 'Done')).toBeNull();
    expect(jiraCategoryOf('Approved')).toBe('done');
  });
});

test.describe('Jira issue → portal ticket', () => {
  const issue = {
    key: 'SPA-12',
    fields: {
      summary: 'Login breaks on Safari',
      status: { name: 'En curso', statusCategory: { key: 'indeterminate' } },
      issuetype: { name: 'Bug', hierarchyLevel: 0 },
      priority: { name: 'Highest' },
      labels: ['safari'],
      description: markdownToAdf('Steps:\n\n1. open\n2. click'),
      parent: { key: 'SPA-1', fields: { summary: 'Auth' } },
      customfield_10020: [
        { id: 3, name: 'Sprint 1', state: 'closed' },
        { id: 7, name: 'Sprint 2', state: 'active', startDate: '2026-11-01', endDate: '2026-11-14' },
      ],
      customfield_10016: 5,
      comment: { comments: [{ id: 99, body: markdownToAdf('On it'), created: '2026-11-02', author: { displayName: 'Ana' } }] },
      attachment: [{ id: 5 }],
      created: '2026-10-30',
      updated: '2026-11-02',
    },
  };

  test('has the shape the pages read, with ids that carry the customer', () => {
    const t = mapIssue(issue, ctx);
    expect(t).toMatchObject({
      id: `jira:${CUSTOMER}:SPA-12`,
      identifier: 'SPA-12',
      number: 12,
      title: 'Login breaks on Safari',
      url: 'https://acme.atlassian.net/browse/SPA-12',
      description: 'Steps:\n\n1. open\n2. click',
      state: { name: 'Development' },
      priorityLabel: 'Urgent',
      prioritySortOrder: 1,
      estimate: 5,
      project: { id: `jira:${CUSTOMER}:SPA-1`, name: 'Auth', slugId: 'SPA-1' },
      cycle: { id: `jira:${CUSTOMER}:sprint:7`, name: 'Sprint 2', isActive: true, isPast: false },
      comments: { nodes: [{ id: '99', body: 'On it', displayName: 'Ana' }] },
      attachments: { nodes: [{ id: `jira:${CUSTOMER}:attachment:5` }] },
      completedAt: null,
    });
    // The Bugs page finds bugs by a "bug" label.
    expect(t.labels.nodes.map((l) => l.name)).toEqual(['bug', 'safari']);
  });

  test('issue types become the labels the pages use', () => {
    expect(typeLabel('Bug')).toBe('bug');
    expect(typeLabel('Story')).toBe('feature');
    expect(typeLabel('Task')).toBeNull();
  });

  test('epics are told apart (they are the "projects", not tickets)', () => {
    expect(isEpic({ fields: { issuetype: { name: 'Epic', hierarchyLevel: 1 } } })).toBe(true);
    expect(isEpic(issue)).toBe(false);
  });

  test('the open sprint wins; a ticket in no sprint has no cycle', () => {
    expect(sprintToCycle([{ id: 1, state: 'closed' }, { id: 2, state: 'future' }], CUSTOMER)?.isFuture).toBe(true);
    expect(sprintToCycle([], CUSTOMER)).toBeNull();
    expect(sprintToCycle(null, CUSTOMER)).toBeNull();
  });
});
