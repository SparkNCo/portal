import { test, expect } from '@playwright/test';
import { performLogin } from './helpers';

async function loginAsDeveloper(page: any) {
  const email = process.env.TEST_DEVELOPER_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (!email || !password) {
    test.skip(true, 'TEST_DEVELOPER_EMAIL / TEST_PASSWORD not set in .env.test');
  }

  await performLogin(page, email!, password!, '/developer');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// ── Login ────────────────────────────────────────────────────────────────────

test.describe('Developer — login', () => {

  test('developer can log in and is redirected to the developer panel', async ({ page }) => {
    const email = process.env.TEST_DEVELOPER_EMAIL;
    const password = process.env.TEST_PASSWORD;

    if (!email || !password) {
      test.skip(true, 'TEST_DEVELOPER_EMAIL / TEST_PASSWORD not set in .env.test');
    }

    await performLogin(page, email!, password!, '/developer');
    expect(page.url()).toContain('/developer');
  });

});

// ── Panel tests (require login) ───────────────────────────────────────────────

test.describe('Developer — panels', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsDeveloper(page);
  });

  // ── Developer dashboard ────────────────────────────────────────────────────

  test('Developer dashboard header is visible', async ({ page }) => {
    await expect(page.getByText('Developer Dashboard')).toBeVisible();
  });

  test('Quick Links card is visible with the correct links', async ({ page }) => {
    await expect(page.getByText('Quick Links')).toBeVisible();
    await expect(page.getByText('Daily Tracker')).toBeVisible();
    await expect(page.getByText('PTO Request')).toBeVisible();
    await expect(page.getByText('Client Escalation')).toBeVisible();
  });

  test('Tool Shortcuts card is visible with the correct tools', async ({ page }) => {
    await expect(page.getByText('Tool Shortcuts')).toBeVisible();
    await expect(page.getByText('JumpCloud')).toBeVisible();
    await expect(page.getByText('PostHog')).toBeVisible();
    await expect(page.getByText('GitHub')).toBeVisible();
  });

  test('issue list loads and sort controls are visible', async ({ page }) => {
    // Sort buttons are always rendered
    await expect(page.getByRole('button', { name: 'Last Updated' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Priority' })).toBeVisible();

    // Issue list title is either "All Tasks" or a project name
    await expect(page.getByText('All Tasks').or(
      page.locator('h2, [class*="font-semibold"]').first()
    )).toBeVisible({ timeout: 15_000 });
  });

  test('switching sort to Priority works', async ({ page }) => {
    const priorityBtn = page.getByRole('button', { name: 'Priority' });
    await expect(priorityBtn).toBeVisible();
    await priorityBtn.click();

    // Button should now be active (accent background)
    await expect(priorityBtn).toHaveClass(/bg-accent/, { timeout: 5_000 });
  });

  // ── Sidebar navigation ─────────────────────────────────────────────────────

  test('sidebar shows the correct nav items for a developer', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Developer' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Chat' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Documents' })).toBeVisible();

    // Settings should NOT be in the sidebar for developers
    await expect(page.getByRole('link', { name: 'Settings' })).not.toBeVisible();
  });

  // ── Chat panel ─────────────────────────────────────────────────────────────

  test('Chat panel loads and shows the sidebar', async ({ page }) => {
    await page.getByRole('link', { name: 'Chat' }).click();
    await page.waitForURL('**/chat', { timeout: 10_000 });

    await expect(page.getByText('Chats').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'New Chat' })).toBeVisible({ timeout: 15_000 });
  });

  // ── Documents panel ────────────────────────────────────────────────────────

  test('Documents panel loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Documents' }).click();
    await page.waitForURL('**/documents', { timeout: 10_000 });

    await expect(page.getByText('Project Documents')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Upload Document')).toBeVisible({ timeout: 10_000 });
  });

  test('Documents panel — DocumentsList card has search, filter, and category tabs', async ({ page }) => {
    await page.getByRole('link', { name: 'Documents' }).click();
    await page.waitForURL('**/documents', { timeout: 10_000 });

    // Wait for the card to render before asserting
    await expect(page.getByPlaceholder('Search documents...')).toBeVisible({ timeout: 10_000 });

    // Filter icon button
    await expect(page.getByTestId('document-filter-btn')).toBeVisible();

    // Category tabs
    for (const category of ['all', 'reports', 'technical', 'design']) {
      await expect(page.getByTestId(`category-tab-${category}`)).toBeVisible();
    }
  });

  test('Documents panel — category filter tabs are clickable and update active state', async ({ page }) => {
    await page.getByRole('link', { name: 'Documents' }).click();
    await page.waitForURL('**/documents', { timeout: 10_000 });

    const reportsBtn = page.getByRole('button', { name: 'Reports' });
    await expect(reportsBtn).toBeVisible({ timeout: 10_000 });
    await reportsBtn.click();

    // After clicking, Reports tab should have the active style (bg-secondary)
    await expect(reportsBtn).toHaveClass(/bg-secondary/, { timeout: 5_000 });
  });

  test('Documents panel — UploadDocument card shows drag-and-drop area and file type hint', async ({ page }) => {
    await page.getByRole('link', { name: 'Documents' }).click();
    await page.waitForURL('**/documents', { timeout: 10_000 });

    await expect(page.getByText('Drag and drop files here, or click to browse')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/PDF, DOCX, XLSX, PNG, JPG/)).toBeVisible({ timeout: 10_000 });
  });

  test('Documents panel — DocumentsList shows loading or empty state while fetching', async ({ page }) => {
    await page.getByRole('link', { name: 'Documents' }).click();
    await page.waitForURL('**/documents', { timeout: 10_000 });

    const emptyState  = page.getByText('No documents found');
    const anyFolder   = page.locator('[data-testid^="document-folder-"]').first();

    // Wait until either state resolves
    await expect(emptyState.or(anyFolder)).toBeVisible({ timeout: 25_000 });

    // Explicitly assert the empty-state message or a project folder
    if (await anyFolder.isVisible()) {
      await expect(anyFolder).toBeVisible();
    } else {
      await expect(emptyState).toBeVisible();
    }
  });

});
