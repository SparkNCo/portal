import { test, expect } from '@playwright/test';
import { LOGIN_ERROR_MESSAGES, loginDestination } from '../../lib/login-destination';

// Where each role lands after logging in (lib/login-destination.ts, used by
// app/login/Login.tsx). Pure logic — no browser, no accounts.

const admin = { role: 'admin' };
const customer = { role: 'customer', clientName: 'Acme' };
const stakeholder = {
  role: 'stakeholder',
  assignment_id: [
    { clientName: 'Acme', linear_slug: 'a1b2c3' },
    { clientName: 'Globex', linear_slug: 'd4e5f6' },
  ],
};
const developer = {
  role: 'developer',
  assignment_id: [
    { clientName: 'Acme', linear_slug: 'a1b2c3' },
    { clientName: 'Globex', linear_slug: 'd4e5f6' },
  ],
};

const go = (to: string) => ({ kind: 'go', to });
const notSetUp = { kind: 'error', message: LOGIN_ERROR_MESSAGES.notSetUp, signOut: true };
const noClient = { kind: 'error', message: LOGIN_ERROR_MESSAGES.noClientAssigned, signOut: false };

test.describe('loginDestination — home page per role', () => {
  test('admin goes to the admin users page', () => {
    expect(loginDestination(admin, null)).toEqual(go('/admin/users'));
  });

  test("customer goes to their own client's dashboard, slug lowercased", () => {
    expect(loginDestination(customer, null)).toEqual(go('/acme/dashboard'));
    expect(loginDestination({ role: 'customer', clientName: 'Spark-Portal' }, null)).toEqual(go('/spark-portal/dashboard'));
  });

  test('a client name with spaces becomes a valid URL path', () => {
    expect(loginDestination({ role: 'customer', clientName: 'Be Assured' }, null)).toEqual(go('/be%20assured/dashboard'));
  });

  test("stakeholder goes to their first assigned client's dashboard", () => {
    expect(loginDestination(stakeholder, null)).toEqual(go('/acme/dashboard'));
  });

  test("stakeholder whose assignment has no clientName uses its linear_slug, then the profile's clientName", () => {
    expect(
      loginDestination({ role: 'stakeholder', assignment_id: [{ clientName: null, linear_slug: 'A1B2C3' }] }, null),
    ).toEqual(go('/a1b2c3/dashboard'));
    expect(loginDestination({ role: 'stakeholder', assignment_id: [], clientName: 'Acme' }, null)).toEqual(
      go('/acme/dashboard'),
    );
  });

  test("developer goes to their first assignment's developer page", () => {
    expect(loginDestination(developer, null)).toEqual(go('/acme/developer'));
    expect(loginDestination(developer, null, null)).toEqual(go('/acme/developer'));
  });

  test('developer goes to the initiative last picked in "Working on", matched ignoring case', () => {
    expect(loginDestination(developer, null, 'Globex')).toEqual(go('/globex/developer'));
    expect(loginDestination(developer, null, 'globex')).toEqual(go('/globex/developer'));
  });

  test('developer whose last pick is no longer theirs goes to their first assignment', () => {
    expect(loginDestination(developer, null, 'Initech')).toEqual(go('/acme/developer'));
  });

  test('developer with no assignments goes to /dev/developer ("No assigned projects yet")', () => {
    expect(loginDestination({ role: 'developer', assignment_id: [] }, null)).toEqual(go('/dev/developer'));
    expect(loginDestination({ role: 'developer' }, null)).toEqual(go('/dev/developer'));
  });

  test('"Working on" only applies to developers', () => {
    expect(loginDestination(admin, null, 'Globex')).toEqual(go('/admin/users'));
    expect(loginDestination(customer, null, 'Globex')).toEqual(go('/acme/dashboard'));
    expect(loginDestination(stakeholder, null, 'Globex')).toEqual(go('/acme/dashboard'));
  });
});

test.describe('loginDestination — the page they were opening', () => {
  test('wins over the home page, for every role', () => {
    for (const profile of [admin, customer, stakeholder, developer]) {
      expect(loginDestination(profile, '/acme/build?issueId=abc-123')).toEqual(go('/acme/build?issueId=abc-123'));
    }
  });

  test('is never followed by an account that is not set up', () => {
    expect(loginDestination({ role: 'lead' }, '/acme/build')).toEqual(notSetUp);
    expect(loginDestination({ role: 'customer', clientName: null }, '/acme/build')).toEqual(notSetUp);
    expect(loginDestination({ role: 'stakeholder', assignment_id: [] }, '/acme/build')).toEqual(noClient);
  });
});

test.describe('loginDestination — accounts with nowhere to go', () => {
  test('customer with no linked client: "not set up", signed out', () => {
    expect(loginDestination({ role: 'customer', clientName: null }, null)).toEqual(notSetUp);
    expect(loginDestination({ role: 'customer' }, null)).toEqual(notSetUp);
  });

  test('stakeholder with no client assigned: says so, and keeps the session', () => {
    expect(loginDestination({ role: 'stakeholder', assignment_id: [] }, null)).toEqual(noClient);
    expect(loginDestination({ role: 'stakeholder' }, null)).toEqual(noClient);
  });

  test('assessment lead (marketing site account): "not set up", signed out', () => {
    expect(loginDestination({ role: 'lead' }, null)).toEqual(notSetUp);
  });

  test('unknown, empty or missing role: "not set up", signed out', () => {
    expect(loginDestination({ role: 'superuser' }, null)).toEqual(notSetUp);
    expect(loginDestination({ role: '' }, null)).toEqual(notSetUp);
    expect(loginDestination({ role: null }, null)).toEqual(notSetUp);
    expect(loginDestination({}, null)).toEqual(notSetUp);
  });

  test('role names are exact: "Admin" is not "admin"', () => {
    expect(loginDestination({ role: 'Admin' }, null)).toEqual(notSetUp);
  });
});
