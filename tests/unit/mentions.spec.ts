import { test, expect } from '@playwright/test';
import {
  decodeMentions,
  encodeMentions,
  matchMentionOptions,
  mentionablePeople,
  mentionQueryAt,
  mentionedIds,
  splitMentions,
} from '../../components/chat/mentions';

// Pure logic behind chat @mentions — no browser needed.

const ana = { id: 'u-ana', name: 'Ana' };
const anaMaria = { id: 'u-ana-maria', name: 'Ana María' };
const dev = { id: 'u-dev', name: 'devtest@example.com' };
const people = [ana, anaMaria, dev];

test.describe('encodeMentions / decodeMentions', () => {
  test('a mention becomes a token with the person’s id, and back', () => {
    const stored = encodeMentions('hi @Ana, can you check?', people);
    expect(stored).toBe('hi <@uid:u-ana>, can you check?');
    expect(decodeMentions(stored, people)).toBe('hi @Ana, can you check?');
  });

  test('the longest name wins, so "Ana María" isn’t read as "Ana"', () => {
    expect(encodeMentions('@Ana María and @Ana', people)).toBe('<@uid:u-ana-maria> and <@uid:u-ana>');
  });

  test('a name that is only the start of a longer word is left alone', () => {
    expect(encodeMentions('@Anabel is not here', people)).toBe('@Anabel is not here');
  });

  test('names that look like emails work, and plain emails are untouched', () => {
    expect(encodeMentions('ping @devtest@example.com please', people)).toBe('ping <@uid:u-dev> please');
    expect(encodeMentions('write to someone@example.com', people)).toBe('write to someone@example.com');
  });

  test('an unknown id reads as "@someone"', () => {
    expect(decodeMentions('hey <@uid:gone>', people)).toBe('hey @someone');
  });

  test('mentionedIds lists each person once', () => {
    expect(mentionedIds('<@uid:u-ana> and <@uid:u-dev>, again <@uid:u-ana>')).toEqual(['u-ana', 'u-dev']);
    expect(mentionedIds('nobody here')).toEqual([]);
  });
});

test.describe('mentionQueryAt', () => {
  test('finds what is being typed after "@"', () => {
    expect(mentionQueryAt('hello @an', 9)).toEqual({ start: 6, query: 'an' });
    expect(mentionQueryAt('@', 1)).toEqual({ start: 0, query: '' });
  });

  test('ignores an "@" inside a word (an email address)', () => {
    expect(mentionQueryAt('mail me at ana@ex', 17)).toBeNull();
  });

  test('only looks before the caret', () => {
    expect(mentionQueryAt('hi @ana there', 2)).toBeNull();
  });
});

test.describe('matchMentionOptions', () => {
  test('names starting with the text come first, then names containing it', () => {
    expect(matchMentionOptions(people, 'an').map((p) => p.name)).toEqual(['Ana', 'Ana María']);
    expect(matchMentionOptions(people, 'mar').map((p) => p.name)).toEqual(['Ana María']);
    expect(matchMentionOptions(people, '').length).toBe(3);
    expect(matchMentionOptions(people, 'zzz')).toEqual([]);
  });
});

test.describe('splitMentions', () => {
  test('separates the mentions from the rest of the text', () => {
    expect(splitMentions('hi @Ana María, and @Ana!', [ana, anaMaria])).toEqual([
      { text: 'hi ' },
      { text: '@Ana María', mention: anaMaria },
      { text: ', and ' },
      { text: '@Ana', mention: ana },
      { text: '!' },
    ]);
  });

  test('text without mentions comes back whole', () => {
    expect(splitMentions('just text', [])).toEqual([{ text: 'just text' }]);
  });
});

test.describe('mentionablePeople', () => {
  // Someone can be in a chat under two ids (their portal id and their Auth id).
  const people = [
    { id: 'me-auth', name: 'Me', person: 'me' },
    { id: 'me-portal', name: 'Me', person: 'me' },
    { id: 'ana-auth', name: 'Ana', person: 'ana' },
    { id: 'ana-portal', name: 'Ana', person: 'ana' },
    { id: 'bob', name: 'Bob' },
  ];

  test('lists each person once, and never the user — under either of their ids', () => {
    expect(mentionablePeople(people, 'me-auth').map((p) => p.id)).toEqual(['ana-auth', 'bob']);
    expect(mentionablePeople(people, 'me-portal').map((p) => p.id)).toEqual(['ana-auth', 'bob']);
  });

  test('a user who is not in the list is simply not offered', () => {
    expect(mentionablePeople(people, 'someone-else').map((p) => p.name)).toEqual(['Me', 'Ana', 'Bob']);
  });
});
