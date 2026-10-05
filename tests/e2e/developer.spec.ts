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
    // Developers land on /{slug}/developer for their initiative, not /dev/.
    expect(new URL(page.url()).pathname).toMatch(/^\/(?!dev\/)[^/]+\/developer$/);
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

  test('issue list loads and the sort control is visible', async ({ page }) => {
    // Sort is a dropdown (Last Updated / Priority), not two buttons.
    await expect(page.getByRole('combobox').filter({ hasText: 'Last Updated' })).toBeVisible({ timeout: 15_000 });

    // Issue list title is either "All Tasks" or a project name
    await expect(page.getByText('All Tasks').or(
      page.locator('h2, [class*="font-semibold"]').first()
    )).toBeVisible({ timeout: 15_000 });
  });

  test('switching sort to Priority works', async ({ page }) => {
    const sort = page.getByRole('combobox').filter({ hasText: 'Last Updated' });
    await expect(sort).toBeVisible({ timeout: 15_000 });
    await sort.click();
    await page.getByRole('option', { name: 'Priority' }).click();

    await expect(page.getByRole('combobox').filter({ hasText: 'Priority' })).toBeVisible({ timeout: 5_000 });
  });

  test('ticket filters offer Cycle instead of Labels, and a picked cycle shows as an active filter', async ({ page }) => {
    await page.getByRole('button', { name: /^All \(/ }).click();
    await page.getByRole('button', { name: 'Filter' }).click();
    const panel = page.getByRole('dialog').filter({ hasText: 'Filters' });
    await expect(panel.getByText('Labels', { exact: true })).toHaveCount(0);

    const cycleHeading = panel.getByText('Cycle', { exact: true });
    if ((await cycleHeading.count()) === 0) {
      test.skip(true, 'No tickets to filter in this environment');
    }
    await expect(cycleHeading).toBeVisible();

    // Pick the first cycle option and check it shows up as an active chip.
    const firstCycle = panel.getByRole('button', { name: /^(Cycle \d+|No cycle)$/ }).first();
    const cycleName = (await firstCycle.innerText()).trim();
    await firstCycle.click();
    await page.getByRole('button', { name: /^Filter/ }).click();
    await expect(panel).not.toBeVisible();
    // The active-filter chip in the toolbar.
    await expect(page.getByRole('button', { name: cycleName, exact: true })).toBeVisible();
  });

  // ── Tickets: whose, and how they're laid out ────────────────────────────────

  test('tickets start on My tickets, and All shows every ticket of the initiative', async ({ page }) => {
    const mine = page.getByRole('button', { name: /^My tickets \(\d+\)$/ });
    const all = page.getByRole('button', { name: /^All \(\d+\)$/ });
    await expect(mine).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });

    const mineCount = Number((await mine.innerText()).match(/\d+/)![0]);
    const allCount = Number((await all.innerText()).match(/\d+/)![0]);
    expect(allCount).toBeGreaterThanOrEqual(mineCount);
    if (mineCount === 0) {
      await expect(page.getByText('No open tickets assigned to you')).toBeVisible();
      await page.getByRole('button', { name: 'Show all tickets' }).click();
    } else {
      await all.click();
    }
    await expect(all).toHaveAttribute('aria-pressed', 'true');

    // Remembered after a reload.
    await page.reload();
    await expect(page.getByRole('button', { name: /^All \(\d+\)$/ })).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
  });

  test('tickets can be shown as a board by status, or as a compact list', async ({ page }) => {
    await page.getByRole('button', { name: /^All \(/ }).click();

    await page.getByRole('button', { name: 'Board view' }).click();
    const columns = ['Backlog', 'Planning', 'Development', 'QA', 'UAT'];
    for (const column of columns) {
      await expect(page.getByRole('region', { name: new RegExp(`^${column}, \\d+ tickets?$`) })).toBeVisible();
    }
    // In that order, and no finished/dropped columns.
    const shown = (await page.getByRole('region', { name: /, \d+ tickets?$/ }).evaluateAll((els) =>
      els.map((el) => el.getAttribute('aria-label')?.split(',')[0]),
    )) as string[];
    expect(shown.slice(0, columns.length)).toEqual(columns);
    for (const hidden of ['Canceled', 'Done', 'Approved']) expect(shown).not.toContain(hidden);

    await page.getByRole('button', { name: 'List view' }).click();
    await expect(page.getByRole('region', { name: /^Planning, / })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Grid view' }).click();
    await expect(page.getByRole('button', { name: 'Grid view' })).toHaveAttribute('aria-pressed', 'true');
  });

  // ── Sidebar navigation ─────────────────────────────────────────────────────

  test('sidebar shows the correct nav items for a developer', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Developer' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Demos' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Chat' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Documents' })).toBeVisible();

    // Settings should NOT be in the sidebar for developers
    await expect(page.getByRole('link', { name: 'Settings' })).not.toBeVisible();
  });

  // ── Demos panel ────────────────────────────────────────────────────────────

  test('Demos link opens /{slug}/demos for the selected project, with upload controls', async ({ page }) => {
    await page.getByRole('link', { name: 'Demos' }).click();
    await expect(page).toHaveURL(/\/[^/]+\/demos$/, { timeout: 10_000 });
    expect(new URL(page.url()).pathname.startsWith('/dev/')).toBe(false);
    await expect(page.getByRole('heading', { name: 'Demos', level: 1 })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Upload Demo' }).first()).toBeVisible({ timeout: 20_000 });

    // The rest of the developer menu stays on the same /{slug}.
    const slug = new URL(page.url()).pathname.split('/')[1];
    await expect(page.getByRole('link', { name: 'Developer' })).toHaveAttribute('href', new RegExp(`^/${slug}/developer`));
  });

  test('old /dev/* links redirect to the same /{slug} page, keeping the query string', async ({ page }) => {
    await page.goto('/dev/build?tab=demo');
    await expect(page).toHaveURL(/\/(?!dev\/)[^/]+\/build\?tab=demo$/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Build', level: 1 })).toBeVisible({ timeout: 15_000 });
  });

  test('old /dev/chat links redirect to /{slug}/chat', async ({ page }) => {
    await page.goto('/dev/chat');
    await expect(page).toHaveURL(/\/(?!dev\/)[^/]+\/chat$/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Chat', level: 1 })).toBeVisible({ timeout: 15_000 });
  });

  // ── Access guard ───────────────────────────────────────────────────────────

  // The test developer is only assigned to Spark-Portal; LuaLink is a real
  // client they aren't on.
  test('opening an initiative they are not assigned to sends them back with a message', async ({ page }) => {
    await page.goto('/lualink/build');
    await expect(page.getByText("You don't have access to that initiative")).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/(?!lualink\/)[^/]+\/developer$/, { timeout: 20_000 });
  });

  test('a client that does not exist shows a 404 with no sidebar and a link home', async ({ page }) => {
    const ownSlug = new URL(page.url()).pathname.split('/')[1];
    await page.goto('/no-such-initiative-e2e/build');
    await expect(page.getByRole('heading', { name: "This client doesn't exist" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Logout' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Go to your home page' })).toHaveAttribute('href', `/${ownSlug}/developer`);
  });

  test('Settings is not available to developers, even on their own initiative', async ({ page }) => {
    const slug = new URL(page.url()).pathname.split('/')[1];
    await page.goto(`/${slug}/settings`);
    await expect(page.getByText("That page isn't available for your role")).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(new RegExp(`/${slug}/developer$`), { timeout: 20_000 });
  });

  for (const page_ of ['dashboard', 'monitor']) {
    test(`the initiative's ${page_} is not available to developers`, async ({ page }) => {
      const slug = new URL(page.url()).pathname.split('/')[1];
      await page.goto(`/${slug}/${page_}`);
      await expect(page.getByText("That page isn't available for your role")).toBeVisible({ timeout: 20_000 });
      await expect(page).toHaveURL(new RegExp(`/${slug}/developer$`), { timeout: 20_000 });
    });
  }

  test('Build and Bugs have no Pin to Dashboard buttons', async ({ page }) => {
    await page.getByRole('link', { name: 'Build' }).click();
    await expect(page.getByRole('heading', { name: 'Build', level: 1 })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Backlog').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('button[title="Pin to Dashboard"], button[title="Unpin from Dashboard"]')).toHaveCount(0);

    await page.getByRole('link', { name: 'Bugs' }).click();
    await expect(page.getByRole('heading', { name: 'Bugs', level: 1 })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('button[title="Pin to Dashboard"], button[title="Unpin from Dashboard"]')).toHaveCount(0);
  });

  // ── Chat panel ─────────────────────────────────────────────────────────────

  test('Chat panel loads and shows the sidebar', async ({ page }) => {
    await page.getByRole('link', { name: 'Chat' }).click();
    await page.waitForURL('**/chat', { timeout: 10_000 });

    await expect(page.getByText('Chats').first()).toBeVisible({ timeout: 15_000 });
    // exact: true — an actual chat group in the test data happens to be
    // named "New Chat testing", which otherwise collides with this button's
    // accessible name under Playwright's default substring matching.
    await expect(page.getByRole('button', { name: 'New Chat', exact: true })).toBeVisible({ timeout: 15_000 });
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
    await expect(page.getByPlaceholder('Ask AI to find a document…')).toBeVisible({ timeout: 10_000 });

    // Category tabs — there is no separate filter icon button anymore, the
    // AI search input above covers that (see components/documents/documents-list.tsx)
    for (const category of ['all', 'reports', 'technical', 'design']) {
      await expect(page.getByTestId(`category-tab-${category}`)).toBeVisible();
    }
  });

  test('Documents panel — category filter tabs are clickable and update active state', async ({ page }) => {
    await page.getByRole('link', { name: 'Documents' }).click();
    await page.waitForURL('**/documents', { timeout: 10_000 });

    // testid, not role name — a document titled with "reports" in it can
    // also match an accessible-name search for "Reports".
    const reportsBtn = page.getByTestId('category-tab-reports');
    await expect(reportsBtn).toBeVisible({ timeout: 10_000 });
    await reportsBtn.click();

    // After clicking, Reports tab should have the active style (bg-primary)
    await expect(reportsBtn).toHaveClass(/bg-primary/, { timeout: 5_000 });
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

    const emptyState   = page.getByText('No documents found');
    // Documents render as a flat list (no per-project folder wrapper) — an
    // "Open <name>" button on a row is a reliable signal one rendered.
    // (Not the header's mobile "Open menu" button.)
    const anyDocument  = page.locator('button[aria-label^="Open "]:not([aria-label="Open menu"])').first();

    // Wait until either state resolves
    await expect(emptyState.or(anyDocument)).toBeVisible({ timeout: 25_000 });

    // Explicitly assert the empty-state message or a rendered document row
    if (await anyDocument.isVisible()) {
      await expect(anyDocument).toBeVisible();
    } else {
      await expect(emptyState).toBeVisible();
    }
  });

});
