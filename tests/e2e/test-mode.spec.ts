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

// POSTs to an edge function, with the test-mode header unless the token is null.
async function postFunction(
  path: string,
  body: Record<string, unknown>,
  testModeToken: string | null = TEST_MODE_TOKEN,
) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
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

const postUsers = (type: string, body: Record<string, unknown>, testModeToken: string | null = TEST_MODE_TOKEN) =>
  postFunction(`users?type=${type}`, body, testModeToken);

const postResetPassword = (email: string, testModeToken: string | null = TEST_MODE_TOKEN) =>
  postFunction('reset-password', { email }, testModeToken);

async function customerByName(clientName: string) {
  const { data, error } = await db().from('customers').select('customer_id').ilike('clientName', clientName).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
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
    const { status, body } = await postUsers('resend-account-email', { email: EXISTING_EMAIL });

    expect(status).toBe(400);
    expect(body.error).toBe("Test mode isn't supported for this request");
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

test.describe('Test mode — creating a customer', () => {
  // A real initiative, so the Linear lookup the flow does has something to find.
  const LINEAR_SLUG = 'f12c1e4fa44b';

  test.beforeAll(() => {
    const missing = [...missingEnv(), ...(TEST_MODE_TOKEN ? [] : ['TEST_MODE_TOKEN'])];
    test.skip(missing.length > 0, `Missing in .env / supabase/functions/.env: ${missing.join(', ')}`);
  });

  test('answers like the real flow, but creates no client, user or email', async () => {
    const email = uniqueEmail('customer');
    const clientName = `testmode-${Date.now()}`;
    const { status, body } = await postUsers('customer', { email, linear_slug: LINEAR_SLUG, clientName });

    expect(status).toBe(200);
    expect(body.testMode).toBe(true);
    expect(body.result.client).toMatchObject({ clientName, linear_slug: LINEAR_SLUG });
    expect(body.result.customer).toMatchObject({ email, role: 'customer', customer_id: body.result.client.customer_id });

    expect(body.emails).toHaveLength(1);
    expect(body.emails[0].to).toBe(email);
    expect(body.emails[0].html).toContain('/set-password#test-mode');

    // Linear was read for real: the projects it would have saved are there,
    // and so is the metrics run it would have started.
    const targets = body.writes.map((w: { target: string; op: string }) => `${w.target}:${w.op}`);
    expect(targets).toEqual([
      'auth.users:invite',
      'portal.customers:insert',
      'portal.customers:update',
      'portal.users:upsert',
      'functions/issueMetrics:trigger',
    ]);
    expect(body.writes[2].data.linear_projects.length).toBeGreaterThan(0);

    expect(await customerByName(clientName)).toBeNull();
    await expectNoUser(email);
  });

  test('the real checks still run: a client name that is taken is refused', async () => {
    const { data: existing } = await db().from('customers').select('clientName').not('clientName', 'is', null).limit(1).single();
    const { status, body } = await postUsers('customer', {
      email: uniqueEmail('customer-taken'),
      linear_slug: LINEAR_SLUG,
      clientName: existing!.clientName,
    });

    expect(status).toBe(500);
    expect(body.error).toBe(`A customer named "${existing!.clientName}" already exists`);
  });
});

test.describe('Test mode — reset password', () => {
  test.beforeAll(() => {
    const missing = [...missingEnv(), ...(TEST_MODE_TOKEN ? [] : ['TEST_MODE_TOKEN'])];
    test.skip(missing.length > 0, `Missing in .env / supabase/functions/.env: ${missing.join(', ')}`);
  });

  test('an existing account: the reset email is built, but no token is issued', async () => {
    const before = await authUserByEmail(EXISTING_EMAIL);
    const { status, body } = await postResetPassword(EXISTING_EMAIL);

    expect(status).toBe(200);
    expect(body).toMatchObject({ testMode: true, result: { success: true } });
    expect(body.emails).toHaveLength(1);
    expect(body.emails[0].to).toBe(EXISTING_EMAIL);
    expect(body.emails[0].subject).toBe('Reset your portal password');
    expect(body.emails[0].html).toContain('/reset-password#test-mode');
    expect(body.writes).toEqual([{ target: 'auth.users', op: 'recovery', data: { email: EXISTING_EMAIL } }]);

    // The account wasn't touched.
    const after = await authUserByEmail(EXISTING_EMAIL);
    expect(after?.recovery_sent_at).toBe(before?.recovery_sent_at);
  });

  test('an unknown email: same success answer, and no email', async () => {
    const { status, body } = await postResetPassword(uniqueEmail('nobody'));

    expect(status).toBe(200);
    expect(body.result).toEqual({ success: true });
    expect(body.emails).toEqual([]);
    expect(body.writes).toEqual([]);
  });

  test('a wrong token is refused', async () => {
    const { status, body } = await postResetPassword(EXISTING_EMAIL, 'not-the-token');

    expect(status).toBe(403);
    expect(body.error).toBe('Invalid test mode token');
  });

  // Regression: without the header a recovery token is issued, as always.
  // (@example.com addresses get no email.)
  test('without the header, the reset goes through as always', async () => {
    const before = await authUserByEmail(EXISTING_EMAIL);
    const { status, body } = await postResetPassword(EXISTING_EMAIL, null);

    expect(status).toBe(200);
    expect(body).toEqual({ success: true });
    const after = await authUserByEmail(EXISTING_EMAIL);
    expect(after?.recovery_sent_at).not.toBe(before?.recovery_sent_at);
  });
});

// These three only email every admin — real inboxes — so there's no run
// without the header here: it would email them all.
const ADMIN_EMAIL_FUNCTIONS = ['project-requests', 'developer-requests', 'stakeholder-notifications'];

test.describe('Test mode — emails to admins', () => {
  let adminEmails: string[] = [];

  test.beforeAll(async () => {
    const missing = [...missingEnv(), ...(TEST_MODE_TOKEN ? [] : ['TEST_MODE_TOKEN'])];
    test.skip(missing.length > 0, `Missing in .env / supabase/functions/.env: ${missing.join(', ')}`);

    // A deployed version without test mode would ignore the header and email
    // every admin for real. Probe first with a request that can't send
    // anything (no fields, wrong token): with test mode it's refused (403);
    // without, it fails validation (400) — then stop here.
    for (const path of ADMIN_EMAIL_FUNCTIONS) {
      const { status } = await postFunction(path, {}, 'not-the-token');
      if (status !== 403) {
        throw new Error(`${path} isn't deployed with test mode (got ${status}, expected 403) — deploy it before running these tests`);
      }
    }

    const { data, error } = await db().from('users').select('email').eq('role', 'admin');
    if (error) throw new Error(error.message);
    adminEmails = data.map((u) => u.email).sort();
  });

  // One email per admin, nothing written.
  function expectAdminEmails(body: any, subject: string) {
    expect(body).toMatchObject({ testMode: true, result: { sent: true }, writes: [] });
    expect(body.emails.map((e: { to: string }) => e.to).sort()).toEqual(adminEmails);
    for (const email of body.emails) expect(email.subject).toBe(subject);
    return body.emails[0].html as string;
  }

  test('project request: every admin is told, with the request', async () => {
    const title = `Test mode project ${Date.now()}`;
    const { status, body } = await postFunction('project-requests', {
      title,
      description: 'A project asked for in test mode',
      requestedBy: 'custest@example.com',
      slug: 'spark-portal',
    });

    expect(status).toBe(200);
    const html = expectAdminEmails(body, `New project request: ${title}`);
    expect(html).toContain(title);
    expect(html).toContain('A project asked for in test mode');
    expect(html).toContain('custest@example.com');
    expect(html).toContain('spark-portal');
  });

  test('developer request: every admin is told, with the request', async () => {
    const { status, body } = await postFunction('developer-requests', {
      role: 'Frontend developer',
      allocation: 20,
      notes: 'Asked for in test mode',
      requestedBy: 'custest@example.com',
      clientName: 'Spark-Portal',
    });

    expect(status).toBe(200);
    const html = expectAdminEmails(body, 'New Spark & Co FDE developer request — Spark-Portal');
    expect(html).toContain('Frontend developer');
    expect(html).toContain('20h/week');
    expect(html).toContain('Asked for in test mode');
    expect(html).toContain('custest@example.com');
  });

  test('stakeholder added: every admin is told who was added', async () => {
    const { status, body } = await postFunction('stakeholder-notifications', {
      stakeholderEmail: 'new-stakeholder@example.com',
      stakeholderName: 'New Stakeholder',
      clientName: 'Spark-Portal',
      addedBy: 'custest@example.com',
    });

    expect(status).toBe(200);
    const html = expectAdminEmails(body, 'New stakeholder added — Spark-Portal');
    expect(html).toContain('New Stakeholder — new-stakeholder@example.com');
    expect(html).toContain('custest@example.com');
  });

  test('the real checks still run: a request missing its required field is refused', async () => {
    const cases = [
      { path: 'project-requests', body: { description: 'no title' }, error: 'Missing title' },
      { path: 'developer-requests', body: { notes: 'no role' }, error: 'Missing role' },
      { path: 'stakeholder-notifications', body: { clientName: 'Spark-Portal' }, error: 'Missing stakeholderEmail' },
    ];
    for (const c of cases) {
      const { status, body } = await postFunction(c.path, c.body);
      expect(status, c.path).toBe(400);
      expect(body.error, c.path).toBe(c.error);
    }
  });

  test('a wrong token is refused before anything is sent', async () => {
    for (const path of ADMIN_EMAIL_FUNCTIONS) {
      const { status, body } = await postFunction(path, { title: 'x', role: 'x', stakeholderEmail: 'x@example.com' }, 'not-the-token');
      expect(status, path).toBe(403);
      expect(body.error, path).toBe('Invalid test mode token');
    }
  });
});
