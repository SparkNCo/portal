import { test, expect } from '@playwright/test';
import { checkSlugAccess, homePathFor } from '../../lib/route-access';

// Who may open which /{slug} page, and where everyone else is sent
// (lib/route-access.ts, used by the [slug] layout). Pure logic — no browser.

const admin = { role: 'admin' };
const customer = { role: 'customer', clientName: 'Acme' };
const stakeholder = {
  role: 'stakeholder',
  assignment_id: [{ clientName: 'Acme', linear_slug: 'a1b2c3' }],
};
const developer = {
  role: 'developer',
  assignment_id: [
    { clientName: 'Acme', linear_slug: 'a1b2c3' },
    { clientName: 'Globex', linear_slug: 'd4e5f6' },
  ],
};

test.describe('homePathFor', () => {
  test('each role lands on its own home page', () => {
    expect(homePathFor(admin)).toBe('/admin/users');
    expect(homePathFor(customer)).toBe('/acme/dashboard');
    expect(homePathFor(stakeholder)).toBe('/acme/dashboard');
    expect(homePathFor(developer)).toBe('/acme/developer');
  });

  test('a developer lands on the initiative they last picked, if it is theirs', () => {
    expect(homePathFor(developer, 'Globex')).toBe('/globex/developer');
    expect(homePathFor(developer, 'NotTheirs')).toBe('/acme/developer');
  });

  test('a developer with no assignments goes to the page that explains it', () => {
    expect(homePathFor({ role: 'developer', assignment_id: [] })).toBe('/dev/developer');
  });

  test('nowhere to send: no client, no role, unknown role', () => {
    expect(homePathFor({ role: 'customer', clientName: null })).toBeNull();
    expect(homePathFor({ role: 'stakeholder', assignment_id: [] })).toBeNull();
    expect(homePathFor({ role: null })).toBeNull();
    expect(homePathFor({ role: 'user' })).toBeNull();
    expect(homePathFor(null)).toBeNull();
  });
});

test.describe('checkSlugAccess — which initiative', () => {
  test('admins open any initiative', () => {
    expect(checkSlugAccess(admin, 'globex', null, 'dashboard')).toEqual({ kind: 'allowed' });
  });

  test('customers open only their own, compared case-insensitively', () => {
    expect(checkSlugAccess(customer, 'acme', null, 'build')).toEqual({ kind: 'allowed' });
    expect(checkSlugAccess(customer, 'ACME', null, 'build')).toEqual({ kind: 'allowed' });
    expect(checkSlugAccess(customer, 'globex', null, 'build')).toEqual({
      kind: 'redirect',
      to: '/acme/dashboard',
      reason: 'initiative',
    });
  });

  test('stakeholders and developers open the initiatives they are assigned to', () => {
    expect(checkSlugAccess(stakeholder, 'acme', null, 'dashboard')).toEqual({ kind: 'allowed' });
    expect(checkSlugAccess(developer, 'globex', null, 'build')).toEqual({ kind: 'allowed' });
    expect(checkSlugAccess(stakeholder, 'globex', null, 'dashboard')).toEqual({
      kind: 'redirect',
      to: '/acme/dashboard',
      reason: 'initiative',
    });
    expect(checkSlugAccess(developer, 'initech', null, 'build')).toEqual({
      kind: 'redirect',
      to: '/acme/developer',
      reason: 'initiative',
    });
  });

  test('older links built from linear_slug still open', () => {
    expect(checkSlugAccess(stakeholder, 'a1b2c3', null, 'dashboard')).toEqual({ kind: 'allowed' });
    expect(checkSlugAccess(developer, 'D4E5F6', null, 'build')).toEqual({ kind: 'allowed' });
  });

  test('a stakeholder can open the client on their own profile (their home falls back to it)', () => {
    const viaProfile = { role: 'stakeholder', clientName: 'Acme', assignment_id: [] };
    expect(checkSlugAccess(viaProfile, 'acme', null, 'dashboard')).toEqual({ kind: 'allowed' });
    expect(homePathFor(viaProfile)).toBe('/acme/dashboard');
  });
});

test.describe('checkSlugAccess — which page', () => {
  test('the Developer page is for developers only', () => {
    expect(checkSlugAccess(developer, 'acme', null, 'developer')).toEqual({ kind: 'allowed' });
    expect(checkSlugAccess(admin, 'acme', null, 'developer')).toEqual({
      kind: 'redirect',
      to: '/acme/dashboard',
      reason: 'page',
    });
    expect(checkSlugAccess(customer, 'acme', null, 'developer')).toEqual({
      kind: 'redirect',
      to: '/acme/dashboard',
      reason: 'page',
    });
  });

  test('developers use their own page instead of Settings, Dashboard and Monitor', () => {
    for (const page of ['settings', 'dashboard', 'monitor']) {
      expect(checkSlugAccess(developer, 'acme', null, page)).toEqual({
        kind: 'redirect',
        to: '/acme/developer',
        reason: 'page',
      });
    }
  });

  test('Query is admins only', () => {
    expect(checkSlugAccess(admin, 'acme', null, 'query')).toEqual({ kind: 'allowed' });
    expect(checkSlugAccess(customer, 'acme', null, 'query')).toEqual({
      kind: 'redirect',
      to: '/acme/dashboard',
      reason: 'page',
    });
  });

  test('every other page is open to anyone who can open the initiative', () => {
    for (const page of ['build', 'bugs', 'chat', 'documents', 'demos']) {
      expect(checkSlugAccess(customer, 'acme', null, page)).toEqual({ kind: 'allowed' });
      expect(checkSlugAccess(developer, 'acme', null, page)).toEqual({ kind: 'allowed' });
    }
  });
});

test.describe('checkSlugAccess — accounts that are not set up', () => {
  test('no profile, no role or an unknown role: "account not set up", never /undefined/…', () => {
    expect(checkSlugAccess(null, 'acme', null, 'dashboard')).toEqual({ kind: 'not-set-up' });
    expect(checkSlugAccess({ role: null }, 'acme', null, 'dashboard')).toEqual({ kind: 'not-set-up' });
    expect(checkSlugAccess({ role: 'user' }, 'acme', null, 'dashboard')).toEqual({ kind: 'not-set-up' });
  });

  test('a known role with nowhere to land when the initiative is not theirs', () => {
    expect(checkSlugAccess({ role: 'customer', clientName: null }, 'acme', null, 'dashboard')).toEqual({
      kind: 'not-set-up',
    });
  });
});
