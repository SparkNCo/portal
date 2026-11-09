import { test, expect } from '@playwright/test';
import { readStoredRedirect, safeRedirect, storedRedirect } from '../../lib/login-redirect';

// Signed out on a page that needs a login: AuthGate remembers the page (in
// sessionStorage, so the login URL stays "/") and the login page takes them
// back there. Pure logic — no browser.

const NOW = 1_800_000_000_000;
const MINUTE = 60 * 1000;

test.describe('login redirect', () => {
  test('the page being opened is kept, query included, and read back', () => {
    const stored = storedRedirect('/acme/build?issueId=abc-123&tab=demo', NOW);
    expect(readStoredRedirect(stored, NOW + MINUTE)).toBe('/acme/build?issueId=abc-123&tab=demo');
  });

  test('nothing is kept for the login page itself', () => {
    expect(storedRedirect('/', NOW)).toBeNull();
  });

  test('an old visit expires after 30 minutes', () => {
    const stored = storedRedirect('/acme/dashboard', NOW);
    expect(readStoredRedirect(stored, NOW + 29 * MINUTE)).toBe('/acme/dashboard');
    expect(readStoredRedirect(stored, NOW + 31 * MINUTE)).toBeNull();
  });

  test('missing, broken or future-dated values give no redirect', () => {
    expect(readStoredRedirect(null, NOW)).toBeNull();
    expect(readStoredRedirect('not json', NOW)).toBeNull();
    expect(readStoredRedirect('{"path":"/acme/dashboard"}', NOW)).toBeNull();
    expect(readStoredRedirect(JSON.stringify({ path: '/acme/dashboard', at: NOW + MINUTE }), NOW)).toBeNull();
  });

  test('only paths inside the site — never another host', () => {
    expect(safeRedirect('/acme/dashboard')).toBe('/acme/dashboard');
    expect(safeRedirect('https://evil.com')).toBeNull();
    expect(safeRedirect('//evil.com')).toBeNull();
    expect(safeRedirect('/\\evil.com')).toBeNull();
    expect(safeRedirect('javascript:alert(1)')).toBeNull();
    expect(storedRedirect('//evil.com', NOW)).toBeNull();
    // A value someone planted in storage by hand is checked again on the way out.
    expect(readStoredRedirect(JSON.stringify({ path: '//evil.com', at: NOW }), NOW)).toBeNull();
  });
});
