import { test, expect } from '@playwright/test';
import {
  MAX_CONTENT_CHARS,
  MAX_SOURCES,
  MIN_SIMILARITY,
  buildAskPrompt,
  MAX_TICKET_ROWS,
  citedSources,
  citedTickets,
  issueCodesIn,
  orderTickets,
  ticketLine,
  ticketList,
  type TicketRow,
  relevantSources,
  withExactMatches,
  sourceHeading,
  type Source,
} from '../../supabase/functions/ask/prompt';

// The global query's prompt (SPA-582): which sources are used, how they're
// written for the AI, and which ones the answer cites. Pure logic — no AI.

const issue: Source = {
  type: 'issue',
  ref: 'SPA-456',
  title: 'Login with SSO',
  createdAt: '2020-02-02T10:00:00Z',
  dueDate: '2021-03-03',
  status: 'Backlog',
  content: 'Users sign in with Google.',
  similarity: 0.9,
};
const doc: Source = {
  type: 'document',
  ref: '123',
  title: 'How login works',
  createdAt: '2019-01-01T00:00:00Z',
  content: 'Login uses Supabase Auth.',
  similarity: 0.85,
};

test.describe('relevantSources', () => {
  test('keeps only matches at or above the threshold, best first', () => {
    const picked = relevantSources([
      { id: 'a', similarity: MIN_SIMILARITY - 0.01 },
      { id: 'b', similarity: 0.84 },
      { id: 'c', similarity: MIN_SIMILARITY },
      { id: 'd', similarity: 0.95 },
    ]);
    expect(picked.map((m) => m.id)).toEqual(['d', 'b', 'c']);
  });

  test('nothing relevant: empty, so the answer is "not found" without calling the AI', () => {
    expect(relevantSources([{ similarity: 0.5 }, { similarity: 0.79 }])).toEqual([]);
  });

  test('at most MAX_SOURCES', () => {
    const many = Array.from({ length: MAX_SOURCES + 5 }, (_, i) => ({ similarity: 0.9 + i / 1000 }));
    expect(relevantSources(many)).toHaveLength(MAX_SOURCES);
  });
});

test.describe('buildAskPrompt', () => {
  test('each source in the ticket format, numbered for citing', () => {
    expect(sourceHeading(issue)).toBe('Issue SPA-456: Login with SSO. Created 2020-02-02. Due 2021-03-03. Backlog');
    expect(sourceHeading(doc)).toBe('Document 123: How login works. Created 2019-01-01.');

    const prompt = buildAskPrompt('How does login work?', [doc, issue]);
    expect(prompt).toContain('[1] Document 123: How login works. Created 2019-01-01.\nLogin uses Supabase Auth.');
    expect(prompt).toContain('[2] Issue SPA-456: Login with SSO.');
    expect(prompt).toContain('Question: How does login work?');
  });

  test('answers only from the sources, and in the question’s language', () => {
    const prompt = buildAskPrompt('¿Cómo funciona el login?', [doc]);
    expect(prompt).toContain('Answer only from the information above');
    expect(prompt.trimEnd().endsWith('Answer in the same language as the question above.')).toBe(true);
  });

  test('long content is cut at MAX_CONTENT_CHARS', () => {
    const long = { ...doc, content: 'x'.repeat(MAX_CONTENT_CHARS + 500) };
    const prompt = buildAskPrompt('q', [long]);
    expect(prompt).toContain(`${'x'.repeat(MAX_CONTENT_CHARS)}…`);
    expect(prompt).not.toContain('x'.repeat(MAX_CONTENT_CHARS + 1));
  });

  test('a source without dates or status still reads cleanly', () => {
    expect(sourceHeading({ ...doc, createdAt: null })).toBe('Document 123: How login works.');
  });
});

test.describe('citedSources', () => {
  test('maps the AI’s numbers to sources, ignoring repeats and numbers out of range', () => {
    const sources = [doc, issue];
    expect(citedSources({ found: true, answer: 'x', sources: [2, 2, 1, 0, 3, 1.5] }, sources)).toEqual([issue, doc]);
    expect(citedSources({ found: true, answer: 'x', sources: [] }, sources)).toEqual([]);
  });
});

test.describe('ticket codes in the question', () => {
  test('finds codes in any case, uppercased, without repeats', () => {
    expect(issueCodesIn('is there a ticket SPA-582 or spa-582? also ABC-12')).toEqual(['SPA-582', 'ABC-12']);
  });

  test('no codes: nothing to look up', () => {
    expect(issueCodesIn('In the dashboard, add a global query')).toEqual([]);
  });

  test('named tickets go first and the same one never shows twice', () => {
    const key = (m: { id: string }) => m.id;
    const merged = withExactMatches([{ id: 'a' }], [{ id: 'b' }, { id: 'a' }, { id: 'c' }], key);
    expect(merged.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  test('never more than MAX_SOURCES', () => {
    const many = Array.from({ length: MAX_SOURCES + 5 }, (_, i) => ({ id: String(i) }));
    expect(withExactMatches(many.slice(0, 2), many, (m) => m.id)).toHaveLength(MAX_SOURCES);
  });
});

test.describe('the live ticket list', () => {
  const row = (over: Partial<TicketRow>): TicketRow => ({
    id: 'id', code: 'SPA-1', title: 'A ticket', status: 'Backlog', cycle: null, priority: null,
    assignee: null, dueDate: null, kind: null, closed: false, updatedAt: '2026-11-01T00:00:00Z', ...over,
  });
  const current = { number: 16, name: null, startsAt: '2026-11-03T00:00:00Z', endsAt: '2026-11-16T00:00:00Z', isActive: true };

  test('one line per ticket: code, title, status, cycle, priority, assignee, due date, type', () => {
    expect(ticketLine(row({ code: 'SPA-582', title: 'Global query', status: 'In Progress', cycle: current, priority: 'High', assignee: 'Facundo', dueDate: '2026-11-20', kind: 'feature' })))
      .toBe('SPA-582 · Global query · In Progress · Cycle 16 (current) · High · Facundo · due 2026-11-20 · feature');
    expect(ticketLine(row({ code: 'SPA-2' }))).toBe('SPA-2 · A ticket · Backlog · No cycle · Unassigned');
  });

  test('current cycle first, then open work, then closed; newest first within each', () => {
    const ordered = orderTickets([
      row({ id: 'closed', closed: true, updatedAt: '2026-11-10T00:00:00Z' }),
      row({ id: 'open-old', updatedAt: '2026-10-01T00:00:00Z' }),
      row({ id: 'open-new', updatedAt: '2026-11-09T00:00:00Z' }),
      row({ id: 'cycle', cycle: current, updatedAt: '2026-09-01T00:00:00Z' }),
    ]);
    expect(ordered.map((r) => r.id)).toEqual(['cycle', 'open-new', 'open-old', 'closed']);
  });

  test('names the current cycle and says when the list is cut', () => {
    const many = Array.from({ length: MAX_TICKET_ROWS + 10 }, (_, i) => row({ id: String(i), code: `SPA-${i}` }));
    many[0] = row({ id: 'c', code: 'SPA-C', cycle: current });
    const text = ticketList(many);
    expect(text).toContain('Current cycle: Cycle 16 (2026-11-03 to 2026-11-16)');
    expect(text).toContain(`Showing ${MAX_TICKET_ROWS} of ${MAX_TICKET_ROWS + 10} tickets`);
    expect(ticketList([])).toBe('');
    expect(ticketList([row({})])).toContain('No cycle is active right now.');
  });

  test('cited tickets by code, any case, known and unrepeated only', () => {
    const rows = [row({ id: 'a', code: 'SPA-1' }), row({ id: 'b', code: 'SPA-2' })];
    const cited = citedTickets({ found: true, answer: '', sources: [], tickets: ['spa-2', 'SPA-2', 'SPA-9', 'SPA-1'] }, rows);
    expect(cited.map((r) => r.id)).toEqual(['b', 'a']);
  });

  test('the prompt carries the ticket list and how to use it', () => {
    const prompt = buildAskPrompt('What is in the current cycle?', [], ticketList([row({ code: 'SPA-7', cycle: current })]));
    expect(prompt).toContain('Ticket list (live from the ticket system');
    expect(prompt).toContain('SPA-7 · A ticket · Backlog · Cycle 16 (current)');
    expect(prompt).toContain('use the ticket list');
  });
});
