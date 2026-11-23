import { test, expect } from '@playwright/test';
import {
  MAX_HOURS_PER_ENTRY,
  MAX_TICKETS_PER_ENTRY,
  entryTickets,
  isValidHours,
  normalizeTickets,
  savedTicketLabel,
} from '../../supabase/functions/hours/hoursRules';

// One Log Hours entry: more than 0, at most 24, in half hours
// (supabase/functions/hours/hoursRules.ts, same as the database check).

test.describe('isValidHours', () => {
  test('whole and half hours from 0.5 to 24', () => {
    for (const h of [0.5, 1, 1.5, 4, 7.5, 23.5, 24]) expect(isValidHours(h)).toBe(true);
  });

  test('at most 24 per entry', () => {
    expect(MAX_HOURS_PER_ENTRY).toBe(24);
    expect(isValidHours(24.5)).toBe(false);
    expect(isValidHours(25)).toBe(false);
  });

  test('only half-hour steps', () => {
    for (const h of [0.25, 1.2, 2.75, 3.33]) expect(isValidHours(h)).toBe(false);
  });

  test('nothing that is zero, negative or not a number', () => {
    for (const h of [0, -1, -0.5, Number.NaN, Number.POSITIVE_INFINITY, '4', null, undefined]) {
      expect(isValidHours(h)).toBe(false);
    }
  });
});

test.describe('normalizeTickets', () => {
  test('keeps id, code and title, trimmed; unknown code or title become null', () => {
    expect(
      normalizeTickets([
        { id: ' a ', code: ' SPA-1 ', title: ' Export to PDF ' },
        { id: 'b', code: '', title: null },
      ]),
    ).toEqual([
      { id: 'a', code: 'SPA-1', title: 'Export to PDF' },
      { id: 'b', code: null, title: null },
    ]);
  });

  test('drops a repeated ticket (same id)', () => {
    expect(normalizeTickets([{ id: 'a', code: 'X', title: 'T' }, { id: 'a', code: 'Y', title: 'U' }])).toEqual([
      { id: 'a', code: 'X', title: 'T' },
    ]);
  });

  test('rejects anything that is not a list of tickets with ids', () => {
    expect(normalizeTickets('nope')).toBeNull();
    expect(normalizeTickets([{ code: 'SPA-1', title: 'No id' }])).toBeNull();
    expect(normalizeTickets([null])).toBeNull();
    expect(normalizeTickets(Array.from({ length: MAX_TICKETS_PER_ENTRY + 1 }, (_, i) => ({ id: `t${i}` })))).toBeNull();
  });

  test('an empty list is fine (no tickets)', () => {
    expect(normalizeTickets([])).toEqual([]);
  });
});

test.describe('entryTickets', () => {
  test('a new entry: its saved tickets', () => {
    const tickets = [{ id: 'a', code: 'SPA-1', title: 'Export' }];
    expect(entryTickets({ tickets, issue_ids: ['a'] })).toEqual(tickets);
  });

  test('an older entry (no tickets saved): one per issue id, to look up', () => {
    expect(entryTickets({ tickets: [], issue_ids: ['a', 'b'] })).toEqual([
      { id: 'a', code: null, title: null },
      { id: 'b', code: null, title: null },
    ]);
    expect(entryTickets({ issue_ids: null })).toEqual([]);
  });
});

test.describe('savedTicketLabel', () => {
  test('"code — title", the title alone, or null (look it up) without a title', () => {
    expect(savedTicketLabel({ id: 'a', code: 'SPA-1', title: 'Export' })).toBe('SPA-1 — Export');
    expect(savedTicketLabel({ id: 'a', code: null, title: 'Export' })).toBe('Export');
    expect(savedTicketLabel({ id: 'a', code: 'SPA-1', title: null })).toBeNull();
  });
});