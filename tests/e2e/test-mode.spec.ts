import { test, expect } from '@playwright/test';
import { ANON_KEY, db, missingEnv, SUPABASE_URL, TEST_MODE_TOKEN } from './notifications.helpers';

// Test mode (supabase/functions/lib/testMode.ts, docs/TEST_MODE.md): the
// flow runs for real — checks, reads — but sends no email and writes nothing,
// and answers with what it would have done. These call the edge functions
// directly, like the app does, plus the `x-test-mode` header the app never
// sends. Run on its own: npx playwright test --project=test-mode
//
// Needs ALLOW_TEST_MODE=true and TEST_MODE_TOKEN set on the functions, and
// the same TEST_MODE_TOKEN in supabase/functions/.env.

const EXISTING_EMAIL = 'testholder@example.com';

const uniqueEmail = (label: string) => `testmode-${label}-${Date.now()}@example.com`;

async function postUsers(
  type: string,
  body: Record<string, unknown>,
  testModeToken: string | null = TEST_MODE_TOKEN,
) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/users?type=${type}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
      ...(testModeToken === null ? {} : { 'x-test-mode': testModeToken }),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function portalUserByEmail(email: string) {
  const { data, error } = await db().from('users').select('id').ilike('email', email).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function authUserByEmail(email: string) {
  const { data, error } = await db().auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(error.message);
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

// Nothing of `email` anywhere: no portal.users row, no Auth account.
async function expectNoUser(email: string) {
  expect(await portalUserByEmail(email)).toBeNull();
  expect(await authUserByEmail(email)).toBeNull();
}

test.describe('Test mode — creating a user', () => {
  test.beforeAll(() => {
    const missing = [...missingEnv(), ...(TEST_MODE_TOKEN ? [] : ['TEST_MODE_TOKEN'])];
    test.skip(missing.length > 0, `Missing in .env / supabase/functions/.env: ${missing.join(', ')}`);
  });

  test('a stakeholder: answers like the real flow, but sends and writes nothing', async () => {
    const email = uniqueEmail('stakeholder');
    const { status, body } = await postUsers('stakeholder', { email, role: 'stakeholder', firstName: 'Test' });

    expect(status).toBe(200);
    expect(body.testMode).toBe(true);
    expect(body.result).toMatchObject({ email, role: 'stakeholder', firstName: 'Test' });

    // The invite it would have sent.
    expect(body.emails).toHaveLength(1);
    expect(body.emails[0].to).toBe(email);
    expect(body.emails[0].subject).toBe("You've been invited to the portal");
    expect(body.emails[0].html).toContain('/set-password#test-mode');

    // What it would have written.
    const targets = body.writes.map((w: { target: string }) => w.target);
    expect(targets).toEqual(['auth.users', 'portal.users']);
    expect(body.writes[1].data).toMatchObject({ email, role: 'stakeholder' });

    await expectNoUser(email);
  });

  test('a developer: its developers record is held back too', async () => {
    const email = uniqueEmail('developer');
    const { status, body } = await postUsers('developer', {
      email,
      role: 'developer',
      developerType: 'internal',
      rateAmount: 50,
      rateType: 'hourly',
    });

    expect(status).toBe(200);
    const developers = body.writes.find((w: { target: string }) => w.target === 'portal.developers');
    expect(developers?.data).toMatchObject({ developer_type: 'internal', rate_amount: 50, rate_type: 'hourly' });
    expect(body.emails).toHaveLength(1);

    await expectNoUser(email);
  });

  test('the real checks still run: an email that is taken is refused', async () => {
    const { status, body } = await postUsers('stakeholder', { email: EXISTING_EMAIL, role: 'stakeholder' });

    expect(status).toBe(500);
    expect(body.error).toBe('A user with this email already exists');
    expect(body.testMode).toBeUndefined();
  });

  test('a wrong token is refused, and nothing runs', async () => {
    const email = uniqueEmail('wrong-token');
    const { status, body } = await postUsers('stakeholder', { email, role: 'stakeholder' }, 'not-the-token');

    expect(status).toBe(403);
    expect(body.error).toBe('Invalid test mode token');
    await expectNoUser(email);
  });

  test('a request test mode does not cover is refused, not run for real', async () => {
    const email = uniqueEmail('customer');
    const { status, body } = await postUsers('customer', {
      email,
      linear_slug: 'testmode',
      clientName: `testmode-${Date.now()}`,
    });

    expect(status).toBe(400);
    expect(body.error).toBe("Test mode isn't supported for this request");
    await expectNoUser(email);
  });

  // Regression: without the header, the flow still creates the user.
  // (@example.com addresses get no email.) Cleans up after itself.
  test('without the header, the user is created as always', async () => {
    const email = uniqueEmail('real');
    try {
      const { status, body } = await postUsers('stakeholder', { email, role: 'stakeholder' }, null);

      expect(status).toBe(200);
      expect(body.testMode).toBeUndefined();
      expect(body).toMatchObject({ email, role: 'stakeholder' });
      expect(await portalUserByEmail(email)).not.toBeNull();
      expect(await authUserByEmail(email)).not.toBeNull();
    } finally {
      const authUser = await authUserByEmail(email);
      await db().from('users').delete().ilike('email', email);
      if (authUser) await db().auth.admin.deleteUser(authUser.id);
    }
    await expectNoUser(email);
  });
});
