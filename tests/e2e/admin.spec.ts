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

  // ── Initiative dropdown ────────────────────────────────────────────────────
  //
  // Admins pick a customer from the sidebar's Initiative dropdown (the same
  // picker developers use) — there's no separate Dashboards page anymore.

  test('Initiative dropdown lists customers and has no Dashboards link', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Dashboards' })).toHaveCount(0);
    // No admin-wide chat either until an initiative is picked.
    await expect(page.getByRole('link', { name: 'Chat' })).toHaveCount(0);

    await page.getByRole('combobox').filter({ hasText: 'Select an initiative' }).click();
    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 15_000 });
  });

  test('picking an initiative opens its dashboard, and switching keeps the page', async ({ page }) => {
    await page.getByRole('combobox').filter({ hasText: 'Select an initiative' }).click();
    const options = page.getByRole('option');
    await expect(options.first()).toBeVisible({ timeout: 15_000 });
    const optionCount = await options.count();
    await options.first().click();

    // Admins use the customer's own top-level route (e.g. /acme/dashboard).
    await expect(page).toHaveURL(/\/[^/]+\/dashboard$/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({ timeout: 10_000 });

    // The Admin section stays reachable from inside a customer's pages.
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();

    if (optionCount < 2) return;
    await page.getByRole('link', { name: 'Build' }).click();
    await expect(page).toHaveURL(/\/[^/]+\/build$/, { timeout: 10_000 });
    const firstSlug = new URL(page.url()).pathname.split('/')[1];

    await page.getByRole('combobox').first().click();
    await page.getByRole('option').nth(1).click();
    // Still on /build, but under the other customer's slug.
    await expect(page).not.toHaveURL(new RegExp(`/${firstSlug}/`), { timeout: 10_000 });
    await expect(page).toHaveURL(/\/[^/]+\/build$/);
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

  // ── Customer / Stakeholder Profile (Preview Links) ────────────────────────
  //
  // Both tests only open the modal, switch to edit mode, and Cancel back out
  // — never Save — so they don't mutate a real customer/stakeholder record
  // in whatever environment these run against. Same reasoning as the "Add
  // ..." modal tests above (open, inspect, Cancel, never submit).

  test('Customer Profile opens read-only, Edit reveals contact fields and Preview Links, Cancel discards', async ({ page }) => {
    const customerSection = page.getByTestId('role-section-customer');
    const profileButton = customerSection.getByRole('button', { name: /Profile/i }).first();

    if ((await profileButton.count()) === 0) {
      test.skip(true, 'No customer rows in this environment');
    }

    await profileButton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Customer Profile')).toBeVisible();

    // Read-only view first — no editable inputs yet.
    await expect(dialog.getByLabel('Client Name')).not.toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save' })).not.toBeVisible();
    // Removed on request — Stripe Customer ID has its own dedicated
    // Settings/Billing flow, not duplicated into this profile form.
    await expect(dialog.getByText('Stripe Customer ID')).not.toBeVisible();

    // Switch into edit mode.
    await dialog.getByRole('button', { name: 'Edit' }).click();
    await expect(dialog.getByLabel('Client Name')).toBeVisible();
    await expect(dialog.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Linear Slug')).toBeVisible();
    await expect(dialog.getByLabel('Stripe Customer ID')).toHaveCount(0);

    await expect(dialog.getByText('Preview Links')).toBeVisible();
    await dialog.getByRole('button', { name: 'Add Preview Link' }).click();
    await expect(dialog.getByPlaceholder('Description, e.g. Test Environment')).toBeVisible();
    await expect(dialog.getByPlaceholder('https://...')).toBeVisible();

    // Cancel discards the draft (including the blank link row just added)
    // and drops back to the read-only view instead of closing the dialog.
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog.getByLabel('Client Name')).not.toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test('Stakeholder Profile opens with editable contact fields', async ({ page }) => {
    const stakeholderSection = page.getByTestId('role-section-stakeholder');
    const profileButton = stakeholderSection.getByRole('button', { name: /Profile/i }).first();

    if ((await profileButton.count()) === 0) {
      test.skip(true, 'No stakeholder rows in this environment');
    }

    await profileButton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Stakeholder Profile')).toBeVisible();
    await expect(dialog.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Username')).toBeVisible();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
  });

  // ── Notifications ──────────────────────────────────────────────────────────

  test('notification popup always offers See all, which opens the Unread/Seen modal', async ({ page }) => {
    await page.getByRole('button', { name: /^Notifications/ }).click();
    await page.getByRole('button', { name: /^See all/ }).click();

    const dialog = page.getByRole('dialog', { name: /All notifications/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('tab', { name: 'Unread' })).toBeVisible();
    await expect(dialog.getByRole('tab', { name: 'Seen' })).toBeVisible();
  });

  // ── Chat panel ─────────────────────────────────────────────────────────────
  //
  // Chat is /{slug}/chat for admins too: pick an initiative first, then open
  // its Chat (there's no /admin/chats inbox anymore).

  async function openFirstInitiativeChat(page: any) {
    await page.getByRole('combobox').filter({ hasText: 'Select an initiative' }).click();
    await page.getByRole('option').first().click();
    await expect(page).toHaveURL(/\/[^/]+\/dashboard$/, { timeout: 15_000 });
    await page.getByRole('link', { name: 'Chat' }).click();
    await expect(page).toHaveURL(/\/(?!admin\/)[^/]+\/chat$/, { timeout: 15_000 });
  }

  test('Chat panel loads and shows the sidebar', async ({ page }) => {
    await openFirstInitiativeChat(page);

    await expect(page.getByRole('heading', { name: 'Chat', level: 1 })).toBeVisible({ timeout: 15_000 });
    // exact: true — an actual chat group in the test data happens to be
    // named "New Chat testing", which otherwise collides with this button's
    // accessible name under Playwright's default substring matching.
    await expect(page.getByRole('button', { name: 'New Chat', exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test('Chat panel initialises CometChat and shows the group list or empty state', async ({ page }) => {
    await openFirstInitiativeChat(page);

    await expect(page.locator('text=Loading chat...')).not.toBeVisible({ timeout: 20_000 });

    const hasGroups = page.locator('a, button').filter({ hasText: /@|Chat/ }).first();
    const emptyState = page.getByText('No chats yet.');
    await expect(hasGroups.or(emptyState)).toBeVisible({ timeout: 15_000 });
  });

});
