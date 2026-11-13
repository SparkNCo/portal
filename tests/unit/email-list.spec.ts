import { test, expect } from '@playwright/test';
import { emailsIn, isEmail } from '../../lib/email-list';

test.describe('emails typed as a list (document Share)', () => {
  test('split on commas, semicolons and spaces; lowercased; no repeats', () => {
    expect(emailsIn('Bob@Example.com, ana@x.io;  bob@example.com\nzoe@y.org')).toEqual([
      'bob@example.com',
      'ana@x.io',
      'zoe@y.org',
    ]);
  });

  test('angle brackets are dropped', () => {
    expect(emailsIn('<bob@example.com>')).toEqual(['bob@example.com']);
  });

  test('invalid entries are kept so they can be shown, and flagged', () => {
    expect(emailsIn('bob@example, ok@x.io')).toEqual(['bob@example', 'ok@x.io']);
    expect(isEmail('bob@example')).toBe(false);
    expect(isEmail('ok@x.io')).toBe(true);
    expect(isEmail('no at sign')).toBe(false);
  });

  test('nothing typed: nothing', () => {
    expect(emailsIn('  ,  ')).toEqual([]);
  });
});
