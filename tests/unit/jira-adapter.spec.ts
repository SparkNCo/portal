import { test, expect } from '@playwright/test';
import { adfToMarkdown, markdownToAdf } from '../../supabase/functions/lib/tickets/jira/adf';
import { jiraCategoryOf, pickTransition, portalStateName } from '../../supabase/functions/lib/tickets/jira/status';
import { isEpic, mapIssue, sprintToCycle, typeLabel } from '../../supabase/functions/lib/tickets/jira/map';
import {
  epicStatusName,
  milestoneJql,
  milestoneStatus,
  roadmapCycle,
  roadmapProject,
} from '../../supabase/functions/lib/tickets/jira/roadmapMap';

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

  test('inline marks, and unclosed or spaced markers stay plain text', () => {
    const inline = (md: string) => markdownToAdf(md).content[0].content;
    expect(inline('a ~~gone~~ _em_ [x](https://x.dev)')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'text', text: 'gone', marks: [{ type: 'strike' }] },
      { type: 'text', text: ' ' },
      { type: 'text', text: 'em', marks: [{ type: 'em' }] },
      { type: 'text', text: ' ' },
      { type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'https://x.dev' } }] },
    ]);
    expect(inline('5 * 3 = 15 *')).toEqual([{ type: 'text', text: '5 * 3 = 15 *' }]);
    expect(inline('[not a link](has space)')).toEqual([{ type: 'text', text: '[not a link](has space)' }]);
  });

  test('a line starting with ``` that is not a code fence is a paragraph (used to hang)', () => {
    expect(markdownToAdf('```js extra\nmore').content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: '```js extra' }, { type: 'hardBreak' }, { type: 'text', text: 'more' }] },
    ]);
  });

  test('long lines of unclosed markers stay fast', () => {
    const start = Date.now();
    markdownToAdf('['.repeat(100_000));
    markdownToAdf('[a](b'.repeat(20_000));
    expect(Date.now() - start).toBeLessThan(500);
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

test.describe('Jira roadmap', () => {
  const status = (key: string, name = key) => ({ name, statusCategory: { key } });

  test('an epic’s status picks its timeline group', () => {
    expect(epicStatusName(status('new', 'Por hacer'))).toBe('Backlog');
    expect(epicStatusName(status('done', 'Listo'))).toBe('In Production');
    expect(epicStatusName(status('indeterminate', 'En curso'))).toBe('En curso');
    // Never mistaken for the two names the timeline sets apart.
    expect(epicStatusName(status('indeterminate', 'Backlog'))).toBe('In Progress');
  });

  test('milestone status from its version and tickets', () => {
    const today = '2026-11-02';
    const t = (key: string) => ({ fields: { status: status(key) } });
    expect(milestoneStatus({ released: true }, [t('new')], today)).toBe('done');
    expect(milestoneStatus(null, [t('done'), t('done')], today)).toBe('done');
    expect(milestoneStatus({ releaseDate: '2026-10-01' }, [t('new')], today)).toBe('overdue');
    expect(milestoneStatus({ releaseDate: '2026-12-01' }, [t('new'), t('indeterminate')], today)).toBe('in-progress');
    expect(milestoneStatus(null, [t('new')], today)).toBe('unstarted');
  });

  test('an epic becomes a row: milestones per version (within the epic), the rest under "No version"', () => {
    const child = (key: string, version: any, sprint: any) => ({
      key,
      fields: { parent: { key: 'SPA-1' }, status: status('new'), fixVersions: version ? [version] : [], customfield_10020: sprint ? [sprint] : null },
    });
    const children = [
      child('SPA-4', { id: '10001', name: 'V1.1' }, { id: 7, state: 'active' }),
      child('SPA-5', { id: '10001', name: 'V1.1' }, null),
      child('SPA-9', null, { id: 8, state: 'future' }),
    ];
    const versions = new Map([['10001', { id: '10001', name: 'V1.1', releaseDate: '2026-12-01' }]]);
    const epic = { key: 'SPA-1', fields: { summary: 'Auth', duedate: '2026-12-15', status: status('indeterminate', 'En curso') } };

    const row = roadmapProject(epic, children, versions, ctx, '2026-11-02');
    expect(row).toMatchObject({ id: `jira:${CUSTOMER}:SPA-1`, name: 'Auth', targetDate: '2026-12-15', status: { name: 'En curso' } });
    expect(row.projectMilestones.nodes.map((m) => [m.name, m.id])).toEqual([
      ['V1.1', `jira:${CUSTOMER}:version:10001:SPA-1`],
      ['No version', `jira:${CUSTOMER}:noversion:SPA-1`],
    ]);
    expect(row.projectMilestones.nodes[0].issues.nodes.map((n) => n.cycle?.id ?? null)).toEqual([`jira:${CUSTOMER}:sprint:7`, null]);
  });

  test('milestone ids narrow the issue search to that epic', () => {
    expect(milestoneJql('version:10001:SPA-1')).toBe('fixVersion = 10001 AND parent = "SPA-1"');
    expect(milestoneJql('version:10001')).toBe('fixVersion = 10001');
    expect(milestoneJql('noversion:SPA-1')).toBe('parent = "SPA-1" AND fixVersion is EMPTY');
  });

  test('sprints become columns labelled by name', () => {
    expect(roadmapCycle({ id: 7, name: 'Sprint 2', state: 'active', startDate: 'a', endDate: 'b' }, CUSTOMER)).toEqual({
      id: `jira:${CUSTOMER}:sprint:7`, number: null, name: 'Sprint 2', startsAt: 'a', endsAt: 'b', isActive: true, isPast: false, isFuture: false,
    });
  });
});
