import { test, expect } from '@playwright/test';
import { withoutBackslashBreaks } from '../../components/client/demo-description';

// The rich text editor saves line breaks as "\" at the end of a line; shown
// as plain newlines so a lone "\" never appears in a demo's description.

test.describe('demo description line breaks', () => {
  test('a "\\" ending a line, or on a line of its own, becomes a plain newline', () => {
    const saved = '**Global Query Demo**\n\\\n\nUsers ask a plain text question \\\nGet a plain text answer.';
    expect(withoutBackslashBreaks(saved)).toBe('**Global Query Demo**\n\n\nUsers ask a plain text question \nGet a plain text answer.');
  });

  test('a "\\" at the very end is dropped; other escapes stay', () => {
    expect(withoutBackslashBreaks('Done.\\')).toBe('Done.');
    expect(withoutBackslashBreaks('Costs \\*not\\* bold')).toBe('Costs \\*not\\* bold');
    expect(withoutBackslashBreaks('Windows line\\\r\nbreak')).toBe('Windows line\r\nbreak');
  });
});
