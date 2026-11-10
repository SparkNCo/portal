import { test, expect } from '@playwright/test';
import {
  MAX_CONTENT_CHARS,
  MAX_SOURCES,
  MIN_SIMILARITY,
  buildAskPrompt,
  citedSources,
  relevantSources,
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
