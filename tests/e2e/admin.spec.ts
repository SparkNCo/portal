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

    // Admins adopt the customer's own top-level route (e.g. /acme/dashboard)
    // instead of a nested /admin/dashboards/... path — see CustomerCard in
    // components/dashboard/dashboards-content.tsx.
    const firstCard = page.locator('a[href$="/dashboard"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await firstCard.click();

    await expect(page).toHaveURL(/\/[^/]+\/dashboard$/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({ timeout: 10_000 });
  });

  // ── Create user modals ─────────────────────────────────────────────────────

  // All three "Add" modals share the same Label+Input fields (see
  // components/shared/add-user-modal-fields.tsx) with realistic example
  // placeholders (e.g. "developer@company.com") rather than field-name
  // placeholders, so assertions target the field's label instead.

  test('Add Developer modal opens and Create is disabled without email', async ({ page }) => {
    await page.getByRole('button', { name: /Add Developer/i }).click();
    // Scoped to the dialog — an unscoped getByLabel('Email') also matches the
    // "Resend account email" icon buttons on the user rows behind the modal.
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create' })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('Add Customer modal opens and Create is disabled without required fields', async ({ page }) => {
    await page.getByRole('button', { name: /Add Customer/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Stripe Customer ID')).toBeVisible();
    await expect(dialog.getByLabel('Linear Slug')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create' })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('Add Stakeholder modal opens and Create is disabled without email', async ({ page }) => {
    await page.getByRole('button', { name: /Add Stakeholder/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create' })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
  });

  // ── Chat panel ─────────────────────────────────────────────────────────────

  test('Chat panel loads and shows the sidebar', async ({ page }) => {
    await page.getByRole('link', { name: 'Chat' }).click();
    await page.waitForURL('**/chats', { timeout: 10_000 });

    await expect(page.getByRole('heading', { name: 'Chat', level: 1 })).toBeVisible({ timeout: 15_000 });
    // exact: true — an actual chat group in the test data happens to be
    // named "New Chat testing", which otherwise collides with this button's
    // accessible name under Playwright's default substring matching.
    await expect(page.getByRole('button', { name: 'New Chat', exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test('Chat panel initialises CometChat and shows the group list or empty state', async ({ page }) => {
    await page.getByRole('link', { name: 'Chat' }).click();
    await page.waitForURL('**/chats', { timeout: 10_000 });

    await expect(page.locator('text=Loading chat...')).not.toBeVisible({ timeout: 20_000 });

    const hasGroups = page.locator('a, button').filter({ hasText: /@|Chat/ }).first();
    const emptyState = page.getByText('No chats yet.');
    await expect(hasGroups.or(emptyState)).toBeVisible({ timeout: 15_000 });
  });

});
