import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fillLoginForm(
  page: any,
  email: string,
  password: string,
) {
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
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

  // ── Successful login ─────────────────────────────────────────────────────
  // These tests require real test-account credentials in .env.test
  // Run with: npx dotenv -e .env.test -- npx playwright test

  test('customer is redirected to the client dashboard', async ({ page }) => {
    const email = process.env.TEST_CUSTOMER_EMAIL;
    const password = process.env.TEST_PASSWORD;

    if (!email || !password) {
      test.skip(true, 'TEST_CUSTOMER_EMAIL / TEST_PASSWORD not set');
    }

    page.on('console', msg => {
      if (msg.type() === 'error') console.log('Browser error:', msg.text());
    });

    await fillLoginForm(page, email!, password!);

    await page.waitForURL('**/dashboard/client', { timeout: 30_000 });
    expect(page.url()).toContain('/dashboard/client');
  });

  test('developer is redirected to the developer dashboard', async ({ page }) => {
    const email = process.env.TEST_DEVELOPER_EMAIL;
    const password = process.env.TEST_PASSWORD;

    if (!email || !password) {
      test.skip(true, 'TEST_DEVELOPER_EMAIL / TEST_PASSWORD not set');
    }

    page.on('console', msg => {
      if (msg.type() === 'error') console.log('Browser error:', msg.text());
    });

    await fillLoginForm(page, email!, password!);

    await page.waitForURL('**/dashboard/developer', { timeout: 30_000 });
    expect(page.url()).toContain('/dashboard/developer');
  });


});
