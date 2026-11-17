import { test, expect, Page } from '@playwright/test';
import {
  currentPath,
  developerClientNames,
  expectedHomePath,
  expectToLandOn,
  fillLoginForm,
  loginAndExpectHome,
  loginCapturingProfile,
} from './helpers';

// The sign-out finished: supabase-js only drops the stored session once the
// logout request succeeds, so navigating away before that (or a failed
// logout) would leave the account signed in.
async function expectSessionCleared(page: Page) {
  await expect
    .poll(
      () => page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))),
      { timeout: 15_000, message: 'the Supabase session is still stored: sign-out did not complete' },
    )
    .toBe(false);
}

function skipUnlessAccount(envEmail: string) {
  if (!process.env[envEmail] || !process.env.TEST_PASSWORD) {
    test.skip(true, `${envEmail} / TEST_PASSWORD not set`);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Login page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // ── Renders correctly ────────────────────────────────────────────────────

  test('shows the login form', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    await expect(page.getByText('Forgot your password?')).toBeVisible();
  });

  // ── Wrong credentials ────────────────────────────────────────────────────

  test('shows an error message with wrong credentials', async ({ page }) => {
    await fillLoginForm(page, 'nobody@example.com', 'wrongpassword');
    // Error text is rendered in a red paragraph once Supabase responds
    const error = page.locator('p.text-red-500, p.text-destructive').first();
    await expect(error).toBeVisible({ timeout: 10_000 });
  });

  // ── Forgot password modal ────────────────────────────────────────────────

  test('opens the forgot password modal', async ({ page }) => {
    await page.getByText('Forgot your password?').click();
    await expect(page.getByText('Reset your password')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send link' })).toBeVisible();
  });

  test('closes the forgot password modal on Cancel', async ({ page }) => {
    await page.getByText('Forgot your password?').click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Reset your password')).not.toBeVisible();
  });

  // ── Successful login: each role lands on its own home page ───────────────
  // Real test accounts from .env.test. The expected page is worked out from
  // the account's own profile (tests/e2e/helpers.ts, expectedHomePath) and
  // compared exactly — the right client, not just "some /dashboard".

  test('admin lands on /admin/users', async ({ page }) => {
    skipUnlessAccount('TEST_ADMIN_EMAIL');
    await loginAndExpectHome(page, 'TEST_ADMIN_EMAIL', 'admin');
  });

  test("customer lands on their own client's dashboard", async ({ page }) => {
    skipUnlessAccount('TEST_CUSTOMER_EMAIL');
    await loginAndExpectHome(page, 'TEST_CUSTOMER_EMAIL', 'customer');
  });

  test("stakeholder lands on their assigned client's dashboard", async ({ page }) => {
    skipUnlessAccount('TEST_HOLDER_EMAIL');
    await loginAndExpectHome(page, 'TEST_HOLDER_EMAIL', 'stakeholder');
  });

  test("developer lands on their first assignment's developer page", async ({ page }) => {
    skipUnlessAccount('TEST_DEVELOPER_EMAIL');
    const profile = await loginAndExpectHome(page, 'TEST_DEVELOPER_EMAIL', 'developer');
    // /{slug}/developer, not the slug-less /dev/developer.
    expect(developerClientNames(profile).length, 'test developer has no assignments').toBeGreaterThan(0);
  });

  test('developer with several initiatives lands on the one last picked in "Working on"', async ({ page }) => {
    skipUnlessAccount('TEST_DEVELOPER_EMAIL');
    const profile = await loginAndExpectHome(page, 'TEST_DEVELOPER_EMAIL', 'developer');
    const projects = developerClientNames(profile);
    test.skip(projects.length < 2, 'the test developer needs 2+ assigned initiatives for this test');

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.locator('#email')).toBeVisible({ timeout: 20_000 });

    // Not the first assignment, so landing there proves the pick was used.
    // Reload: the "Working on" value is read from storage when the app loads.
    const picked = projects[1]!;
    await page.evaluate((name) => localStorage.setItem('dev-selected-project', name), picked);
    await page.reload();

    await loginCapturingProfile(page, process.env.TEST_DEVELOPER_EMAIL!, process.env.TEST_PASSWORD!);
    await expectToLandOn(page, expectedHomePath(profile, picked));
    expect(currentPath(page)).toBe(`/${picked.toLowerCase()}/developer`);
  });

  test('developer whose "Working on" pick is not theirs lands on their first assignment', async ({ page }) => {
    skipUnlessAccount('TEST_DEVELOPER_EMAIL');
    await page.evaluate(() => localStorage.setItem('dev-selected-project', 'no-such-initiative-e2e'));
    await page.reload();
    const profile = await loginCapturingProfile(page, process.env.TEST_DEVELOPER_EMAIL!, process.env.TEST_PASSWORD!);
    await expectToLandOn(page, expectedHomePath(profile));
  });

  // ── Signed out on a portal page ──────────────────────────────────────────
  // Sent to log in first, whatever the page: a real client and a made-up one
  // look the same, so a signed-out visitor can't tell which clients exist.

  test('signed out, a portal page sends you to a clean login page', async ({ page }) => {
    await page.goto('/spark-portal/build?issueId=abc-123');
    await expect(page.locator('#email')).toBeVisible({ timeout: 20_000 });
    const url = new URL(page.url());
    expect(url.pathname).toBe('/');
    // The page is remembered in sessionStorage, not in the URL.
    expect(url.search).toBe('');
  });

  test('signed out, a client that does not exist also sends you to log in (no 404)', async ({ page }) => {
    await page.goto('/no-such-initiative-e2e/dashboard');
    await expect(page.locator('#email')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: "This client doesn't exist" })).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('after logging in, you land on the page you were opening', async ({ page }) => {
    const email = process.env.TEST_CUSTOMER_EMAIL;
    const password = process.env.TEST_PASSWORD;
    if (!email || !password) test.skip(true, 'TEST_CUSTOMER_EMAIL / TEST_PASSWORD not set');
    await page.goto('/spark-portal/build');
    await expect(page.locator('#email')).toBeVisible({ timeout: 20_000 });
    await fillLoginForm(page, email!, password!);
    await page.waitForURL('**/spark-portal/build', { timeout: 30_000 });
  });

  test('signed out on an admin page, an admin lands back on it after logging in', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_PASSWORD;
    if (!email || !password) test.skip(true, 'TEST_ADMIN_EMAIL / TEST_PASSWORD not set');
    // Not the admin's home page (/admin/users), so landing here proves the redirect.
    await page.goto('/admin/chats');
    await expect(page.locator('#email')).toBeVisible({ timeout: 20_000 });
    expect(new URL(page.url()).pathname).toBe('/');
    await fillLoginForm(page, email!, password!);
    await page.waitForURL('**/admin/chats', { timeout: 30_000 });
  });

  test('coming back to an initiative that is not yours: your home page, with a message', async ({ page }) => {
    const email = process.env.TEST_CUSTOMER_EMAIL;
    const password = process.env.TEST_PASSWORD;
    if (!email || !password) test.skip(true, 'TEST_CUSTOMER_EMAIL / TEST_PASSWORD not set');
    await page.goto('/lualink/build');
    await expect(page.locator('#email')).toBeVisible({ timeout: 20_000 });
    await fillLoginForm(page, email!, password!);
    await expect(page.getByText("You don't have access to that initiative")).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/(?!lualink\/)[^/]+\/dashboard$/, { timeout: 20_000 });
  });

  test('after logging out, the next login goes to the home page, not the page you left', async ({ page }) => {
    const email = process.env.TEST_CUSTOMER_EMAIL;
    const password = process.env.TEST_PASSWORD;
    if (!email || !password) test.skip(true, 'TEST_CUSTOMER_EMAIL / TEST_PASSWORD not set');
    await fillLoginForm(page, email!, password!);
    await page.waitForURL('**/dashboard', { timeout: 30_000 });
    const slug = new URL(page.url()).pathname.split('/')[1];

    await page.goto(`/${slug}/build`);
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.locator('#email')).toBeVisible({ timeout: 20_000 });

    await fillLoginForm(page, email!, password!);
    await page.waitForURL(`**/${slug}/dashboard`, { timeout: 30_000 });
  });

  test('a redirect to another site planted in storage is ignored', async ({ page }) => {
    const email = process.env.TEST_CUSTOMER_EMAIL;
    const password = process.env.TEST_PASSWORD;
    if (!email || !password) test.skip(true, 'TEST_CUSTOMER_EMAIL / TEST_PASSWORD not set');
    await page.evaluate(() =>
      sessionStorage.setItem('portal.loginRedirect', JSON.stringify({ path: '//evil.example.com', at: Date.now() })),
    );
    await fillLoginForm(page, email!, password!);
    await page.waitForURL('**/dashboard', { timeout: 30_000 });
    expect(new URL(page.url()).host).not.toContain('evil.example.com');
  });

  // ── Profile can't be loaded after a successful sign-in ───────────────────
  // The profile request (GET /users?email=) is intercepted, so these don't
  // need a real broken account.

  async function signInWithProfileResponse(page: Page, status: number, body: string) {
    const email = process.env.TEST_CUSTOMER_EMAIL;
    const password = process.env.TEST_PASSWORD;
    if (!email || !password) test.skip(true, 'TEST_CUSTOMER_EMAIL / TEST_PASSWORD not set');
    await page.route('**/functions/v1/users?email=*', (route) =>
      route.fulfill({ status, contentType: 'application/json', body }),
    );
    await fillLoginForm(page, email!, password!);
  }

  test('no portal user row: shows "account not set up" and stays signed out', async ({ page }) => {
    await signInWithProfileResponse(page, 200, 'null');
    await expect(page.getByText("Your account isn't set up yet. Contact your administrator.")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#email')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/');

    // The session was cleared: a portal page sends them to log in again.
    await expectSessionCleared(page);
    await page.unroute('**/functions/v1/users?email=*');
    await page.goto('/spark-portal/dashboard');
    await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('stakeholder with no client assigned: says so and stays on the login page', async ({ page }) => {
    await signInWithProfileResponse(
      page,
      200,
      JSON.stringify({ id: 'e2e-stakeholder', email: process.env.TEST_CUSTOMER_EMAIL, role: 'stakeholder', clientName: null, assignment_id: [] }),
    );
    await expect(page.getByText('No client assigned to this account. Contact your administrator.')).toBeVisible({ timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe('/');
  });

  // Accounts with no page to land on: the message, still on the login page,
  // and the session ended (a portal page asks them to log in again).
  async function expectNotSetUpAndSignedOut(page: Page) {
    await expect(page.getByText("Your account isn't set up yet. Contact your administrator.")).toBeVisible({ timeout: 15_000 });
    expect(currentPath(page)).toBe('/');
    await expectSessionCleared(page);
    await page.unroute('**/functions/v1/users?email=*');
    await page.goto('/spark-portal/dashboard');
    await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });
    expect(currentPath(page)).toBe('/');
  }

  test('assessment lead (marketing site account): "account not set up", signed out', async ({ page }) => {
    await signInWithProfileResponse(
      page,
      200,
      JSON.stringify({ id: 'e2e-lead', email: process.env.TEST_CUSTOMER_EMAIL, role: 'lead' }),
    );
    await expectNotSetUpAndSignedOut(page);
  });

  test('unknown role: "account not set up", signed out', async ({ page }) => {
    await signInWithProfileResponse(
      page,
      200,
      JSON.stringify({ id: 'e2e-unknown', email: process.env.TEST_CUSTOMER_EMAIL, role: 'superuser' }),
    );
    await expectNotSetUpAndSignedOut(page);
  });

  test('customer with no linked client: "account not set up", signed out (never /undefined/dashboard)', async ({ page }) => {
    await signInWithProfileResponse(
      page,
      200,
      JSON.stringify({ id: 'e2e-customer', email: process.env.TEST_CUSTOMER_EMAIL, role: 'customer', clientName: null }),
    );
    await expectNotSetUpAndSignedOut(page);
  });

  test('profile request fails: shows a retry message, and logging in again works', async ({ page }) => {
    await signInWithProfileResponse(page, 500, '{"error":"boom"}');
    await expect(page.getByText("We couldn't load your account. Please try again.")).toBeVisible({ timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe('/');

    // Retry once the profile request works again.
    await page.unroute('**/functions/v1/users?email=*');
    await fillLoginForm(page, process.env.TEST_CUSTOMER_EMAIL!, process.env.TEST_PASSWORD!);
    await page.waitForURL('**/dashboard', { timeout: 30_000 });
  });


});
