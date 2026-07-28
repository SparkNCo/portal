import { test, expect } from '@playwright/test';
import { performLogin } from './helpers';

async function loginAsAdmin(page: any) {
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (!email || !password) {
    test.skip(true, 'TEST_ADMIN_EMAIL / TEST_PASSWORD not set in .env.test');
  }

  await performLogin(page, email!, password!, '/users');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// ── Login ────────────────────────────────────────────────────────────────────

test.describe('Admin — login', () => {

  test('admin can log in and is redirected to the admin panel', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_PASSWORD;

    if (!email || !password) {
      test.skip(true, 'TEST_ADMIN_EMAIL / TEST_PASSWORD not set in .env.test');
    }

    await performLogin(page, email!, password!, '/users');
    expect(page.url()).toContain('/users');
  });

});

// ── Panel tests (require login) ───────────────────────────────────────────────

test.describe('Admin — panels', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // ── Users panel ────────────────────────────────────────────────────────────

  test('Users panel loads and shows user rows', async ({ page }) => {
    await expect(page.getByText('Users').first()).toBeVisible();
    await expect(page.locator('text=Loading users...')).not.toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('p').filter({ hasText: /@/ }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  // ── Dashboards panel ───────────────────────────────────────────────────────

  test('Dashboards panel shows the customer list', async ({ page }) => {
    await page.getByRole('link', { name: 'Dashboards' }).click();
    await page.waitForURL('**/dashboards', { timeout: 10_000 });

    await expect(page.getByText('Dashboards').first()).toBeVisible();
    await expect(page.locator('text=Loading')).not.toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('p').filter({ hasText: /@/ }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('clicking a customer card opens their dashboard', async ({ page }) => {
    await page.getByRole('link', { name: 'Dashboards' }).click();
    await page.waitForURL('**/dashboards', { timeout: 10_000 });

    const firstCard = page.locator('a[href*="/dashboards/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await firstCard.click();

    await expect(page).toHaveURL(/\/dashboards\/.+\/dashboard/, { timeout: 10_000 });
    await expect(page.getByText('Client Dashboard')).toBeVisible({ timeout: 10_000 });
  });

  // ── Create user modals ─────────────────────────────────────────────────────

  test('Add Developer modal opens and Create is disabled without email', async ({ page }) => {
    await page.getByRole('button', { name: /Add Developer/i }).click();
    await expect(page.getByPlaceholder('Developer email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create' })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByPlaceholder('Developer email')).not.toBeVisible();
  });

  test('Add Customer modal opens and Create is disabled without required fields', async ({ page }) => {
    await page.getByRole('button', { name: /Add Customer/i }).click();
    await expect(page.getByPlaceholder('Client email')).toBeVisible();
    await expect(page.getByPlaceholder('Stripe Customer ID')).toBeVisible();
    await expect(page.getByPlaceholder('Linear Slug')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create' })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByPlaceholder('Client email')).not.toBeVisible();
  });

  test('Add Stakeholder modal opens and Create is disabled without email', async ({ page }) => {
    await page.getByRole('button', { name: /Add Stakeholder/i }).click();
    await expect(page.getByPlaceholder('Stakeholder email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create' })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByPlaceholder('Stakeholder email')).not.toBeVisible();
  });

  // ── Chat panel ─────────────────────────────────────────────────────────────

  test('Chat panel loads and shows the sidebar', async ({ page }) => {
    await page.getByRole('link', { name: 'Chat' }).click();
    await page.waitForURL('**/chat', { timeout: 10_000 });

    await expect(page.getByText('Chats').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'New Chat' })).toBeVisible({ timeout: 15_000 });
  });

  test('Chat panel initialises CometChat and shows the group list or empty state', async ({ page }) => {
    await page.getByRole('link', { name: 'Chat' }).click();
    await page.waitForURL('**/chat', { timeout: 10_000 });

    await expect(page.locator('text=Loading chat...')).not.toBeVisible({ timeout: 20_000 });

    const hasGroups = page.locator('a, button').filter({ hasText: /@|Chat/ }).first();
    const emptyState = page.getByText('No chats yet.');
    await expect(hasGroups.or(emptyState)).toBeVisible({ timeout: 15_000 });
  });

});
