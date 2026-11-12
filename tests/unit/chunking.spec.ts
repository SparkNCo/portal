import { test, expect } from '@playwright/test';
import { CHUNK_WORDS, MAX_CHUNKS, OVERLAP_WORDS, chunkObject, splitBody } from '../../supabase/functions/lib/chunking';

// How objects are split into chunks before embedding (lib/chunking.ts).
// Pure logic — no model, no database.

const words = (n: number, prefix = 'w') => Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(' ');
const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

test.describe('chunkObject', () => {
  test('short text is one chunk, starting with the title', () => {
    expect(chunkObject({ title: 'Login with SSO', body: 'Users sign in with Google.' })).toEqual([
      { index: 0, text: 'Login with SSO\n\nUsers sign in with Google.' },
    ]);
  });

  test('no body: one chunk with the title, so the object can still be found', () => {
    expect(chunkObject({ title: 'roadmap.pdf', body: '' })).toEqual([{ index: 0, text: 'roadmap.pdf' }]);
    expect(chunkObject({ title: 'roadmap.pdf', body: null })).toEqual([{ index: 0, text: 'roadmap.pdf' }]);
  });

  test('issues: chunk 0 is the title alone, the body follows from 1', () => {
    expect(chunkObject({ title: 'Export PDF', body: 'Download the roadmap.', titleChunk: true })).toEqual([
      { index: 0, text: 'Export PDF' },
      { index: 1, text: 'Export PDF\n\nDownload the roadmap.' },
    ]);
    expect(chunkObject({ title: 'Export PDF', body: '   ', titleChunk: true })).toEqual([{ index: 0, text: 'Export PDF' }]);
  });

  test('indexes are consecutive from 0', () => {
    const chunks = chunkObject({ title: 'Doc', body: words(CHUNK_WORDS * 3), titleChunk: true });
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
  });

  test('a huge body is capped at MAX_CHUNKS', () => {
    const chunks = chunkObject({ title: 'Huge', body: words(CHUNK_WORDS * (MAX_CHUNKS + 10)) });
    expect(chunks).toHaveLength(MAX_CHUNKS);
  });
});

test.describe('splitBody — headings and packing', () => {
  test('short sections are packed together, in order', () => {
    const body = '# Goal\nShip SSO.\n\n## Scope\nGoogle only.\n\n## Out of scope\nSAML.';
    expect(splitBody(body)).toEqual(['# Goal\nShip SSO.\n\n## Scope\nGoogle only.\n\n## Out of scope\nSAML.']);
  });

  test('a new chunk starts at a heading once the current one is full', () => {
    const body = `# One\n${words(200, 'a')}\n\n# Two\n${words(200, 'b')}`;
    const pieces = splitBody(body);
    expect(pieces).toHaveLength(2);
    expect(pieces[0]).toMatch(/^# One\n/);
    expect(pieces[1]).toMatch(/^# Two\n/);
  });

  test('a heading stays with the text below it', () => {
    // Intro + Details don't fit together, so Details starts its own chunk,
    // heading included.
    const details = words(CHUNK_WORDS - 10, 'd');
    const pieces = splitBody(`Intro ${words(20, 'i')}.\n\n# Details\n${details}`);
    expect(pieces).toEqual([`Intro ${words(20, 'i')}.`, `# Details\n${details}`]);
  });

  test('a long section is split by paragraphs, each piece within the limit', () => {
    const body = `# Long\n${words(200, 'p')}\n\n${words(200, 'q')}\n\n${words(200, 'r')}`;
    const pieces = splitBody(body);
    expect(pieces).toHaveLength(3);
    for (const piece of pieces) {
      expect(countWords(piece)).toBeLessThanOrEqual(CHUNK_WORDS + 1);
    }
  });

  test('one huge paragraph becomes overlapping windows that cover every word', () => {
    const total = CHUNK_WORDS * 2 + 10;
    const pieces = splitBody(words(total));
    const step = CHUNK_WORDS - OVERLAP_WORDS;
    expect(pieces).toHaveLength(Math.ceil((total - OVERLAP_WORDS) / step));
    for (const piece of pieces) {
      expect(countWords(piece)).toBeLessThanOrEqual(CHUNK_WORDS);
    }
    // Consecutive windows share OVERLAP_WORDS words.
    const first = pieces[0]!.split(' ');
    const second = pieces[1]!.split(' ');
    expect(second.slice(0, OVERLAP_WORDS)).toEqual(first.slice(-OVERLAP_WORDS));
    // Nothing is lost: the first and last words are in some chunk.
    expect(pieces[0]).toContain('w0 ');
    expect(pieces.at(-1)).toContain(`w${total - 1}`);
  });

  test('text without headings, Windows line endings and blank input', () => {
    expect(splitBody('Line one.\r\nLine two.')).toEqual(['Line one.\nLine two.']);
    expect(splitBody('')).toEqual([]);
    expect(splitBody('\n\n   \n')).toEqual([]);
    expect(splitBody(undefined)).toEqual([]);
  });

  test('a "#" that is not a heading (e.g. "#123") does not split', () => {
    expect(splitBody('See ticket #123 for context.\n#hashtag too')).toEqual(['See ticket #123 for context.\n#hashtag too']);
  });
});
