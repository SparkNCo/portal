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

  test('Initiative dropdown preselects an initiative and lists customers, with no Dashboards link', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Dashboards' })).toHaveCount(0);

    // Something is always selected (the last opened initiative, or the first
    // one in a fresh browser), so the customer items link to it right away.
    const picker = page.getByRole('combobox').first();
    await expect(picker).not.toHaveText(/Select an initiative/, { timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Chat' })).toHaveAttribute('href', /^\/[^/]+\/chat$/);
    await expect(page).toHaveURL(/\/admin\/users$/);

    await picker.click();
    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 15_000 });
  });

  test('customer items stay listed but disabled while there is no initiative', async ({ page }) => {
    await page.route('**/functions/v1/users?type=customers', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await page.reload();

    const nav = page.locator('aside nav');
    for (const label of ['Dashboard', 'Monitor', 'Build', 'Bugs', 'Demos', 'Documents', 'Chat', 'Settings']) {
      await expect(nav.getByText(label, { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(nav.getByRole('link', { name: label, exact: true })).toHaveCount(0);
    }
    await expect(nav.getByRole('link', { name: 'Users' })).toBeVisible();
  });

  test('picking an initiative on an admin page only selects it; its items open its pages, and switching keeps the page', async ({ page }) => {
    const picker = page.getByRole('combobox').first();
    await expect(picker).not.toHaveText(/Select an initiative/, { timeout: 15_000 });
    await picker.click();
    const options = page.getByRole('option');
    await expect(options.first()).toBeVisible({ timeout: 15_000 });
    const optionCount = await options.count();
    const target = options.nth(optionCount > 1 ? 1 : 0);
    const label = (await target.innerText()).trim();
    await target.click();

    // No navigation yet — the items just point at the picked initiative.
    await expect(picker).toHaveText(label);
    await expect(page).toHaveURL(/\/admin\/users$/);
    const slug = encodeURIComponent(label.toLowerCase());
    await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toHaveAttribute('href', `/${slug}/dashboard`);

    // Admins use the customer's own top-level route (e.g. /acme/dashboard).
    await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${slug}/dashboard$`), { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({ timeout: 10_000 });

    // The Admin section stays reachable from inside a customer's pages.
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();

    if (optionCount < 2) return;
    await page.getByRole('link', { name: 'Build' }).click();
    await expect(page).toHaveURL(/\/[^/]+\/build$/, { timeout: 10_000 });

    await picker.click();
    await page.getByRole('option').first().click();
    // Still on /build, but under the other customer's slug.
    await expect(page).not.toHaveURL(new RegExp(`/${slug}/`), { timeout: 10_000 });
    await expect(page).toHaveURL(/\/[^/]+\/build$/);
  });

  test('admin pages preselect the last initiative opened in this browser', async ({ page }) => {
    const picker = page.getByRole('combobox').first();
    await expect(picker).not.toHaveText(/Select an initiative/, { timeout: 15_000 });
    await picker.click();
    const options = page.getByRole('option');
    await expect(options.first()).toBeVisible({ timeout: 15_000 });
    const target = options.last();
    const label = (await target.innerText()).trim();
    await target.click();
    await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
    await expect(page).toHaveURL(/\/[^/]+\/dashboard$/, { timeout: 10_000 });

    await page.getByRole('link', { name: 'Users' }).click();
    await expect(page).toHaveURL(/\/admin\/users$/, { timeout: 10_000 });
    await expect(picker).toHaveText(label, { timeout: 15_000 });

    await page.reload();
    await expect(page.getByRole('combobox').first()).toHaveText(label, { timeout: 15_000 });
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

  // A row's action buttons only show on hover (desktop), so wait for the
  // section's rows, hover the first one, then open its Profile.
  async function openFirstProfile(page: any, role: 'customer' | 'stakeholder') {
    const section = page.getByTestId(`role-section-${role}`);
    const firstRow = section.locator('p[title*="@"]').first();
    await expect(firstRow.or(section.getByText(`No ${role}s found`))).toBeVisible({ timeout: 15_000 });
    if ((await firstRow.count()) === 0) {
      test.skip(true, `No ${role} rows in this environment`);
    }
    await firstRow.hover();
    await section.getByRole('button', { name: 'Profile' }).first().click();
  }

  test('Customer Profile opens read-only, Edit reveals contact fields and Preview Links, Cancel discards', async ({ page }) => {
    await openFirstProfile(page, 'customer');
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

    await expect(dialog.getByText('Preview Links', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Add Preview Link' }).click();
    await expect(dialog.getByPlaceholder('Description, e.g. Test Environment')).toBeVisible();
    await expect(dialog.getByPlaceholder('https://...')).toBeVisible();

    // Cancel discards the draft (including the blank link row just added)
    // and drops back to the read-only view instead of closing the dialog.
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog.getByLabel('Client Name')).not.toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test('Stakeholder Profile opens read-only, and Edit reveals editable contact fields', async ({ page }) => {
    await openFirstProfile(page, 'stakeholder');

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Stakeholder Profile')).toBeVisible();
    // Read-only first: values shown, no inputs.
    await expect(dialog.getByText('Username', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Email', { exact: true })).toHaveCount(0);

    // Edit opens the editable form; Cancel closes it without saving.
    await dialog.getByRole('button', { name: 'Edit' }).click();
    const editDialog = page.getByRole('dialog');
    await expect(editDialog.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(editDialog.getByLabel('Username')).toBeVisible();

    await editDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  // ── Role-specific pages ────────────────────────────────────────────────────

  test('the developer-only page sends an admin to the initiative dashboard', async ({ page }) => {
    await page.goto('/spark-portal/developer');
    await expect(page.getByText("That page isn't available for your role")).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/spark-portal\/dashboard$/, { timeout: 20_000 });
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
  // Chat is /{slug}/chat for admins too, for the selected initiative (there's
  // no /admin/chats inbox anymore).

  async function openFirstInitiativeChat(page: any) {
    // An initiative is always preselected, so Chat already points at it.
    await expect(page.getByRole('combobox').first()).not.toHaveText(/Select an initiative/, { timeout: 15_000 });
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
