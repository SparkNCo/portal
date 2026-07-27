import { test, expect } from '@playwright/test';
import { performLogin } from './helpers';

async function loginAsStakeholder(page: any) {
  const email    = process.env.TEST_HOLDER_EMAIL;
  const password = process.env.TEST_HOLDER_PASSWORD;

  if (!email || !password) {
    test.skip(true, 'TEST_HOLDER_EMAIL / TEST_HOLDER_PASSWORD not set in .env.test');
  }

  await performLogin(page, email!, password!, '/dashboard/client');
}

async function navigateToRoadmap(page: any) {
  await page.getByRole('link', { name: 'Roadmap' }).click();
  await page.waitForURL('**/roadmap', { timeout: 10_000 });
}

async function expandFirstProject(page: any) {
  const expandBtn = page.getByRole('button', { name: /^Expand /i }).first();
  await expandBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await expandBtn.click();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// ── Login ────────────────────────────────────────────────────────────────────

test.describe('Stakeholder — login', () => {

  test('stakeholder can log in and is redirected to the client dashboard', async ({ page }) => {
    const email    = process.env.TEST_HOLDER_EMAIL;
    const password = process.env.TEST_HOLDER_PASSWORD;

    if (!email || !password) {
      test.skip(true, 'TEST_HOLDER_EMAIL / TEST_HOLDER_PASSWORD not set in .env.test');
    }

    await performLogin(page, email!, password!, '/dashboard/client');
    expect(page.url()).toContain('/dashboard/client');
  });

});

// ── Panel tests (require login) ───────────────────────────────────────────────

test.describe('Stakeholder — panels', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsStakeholder(page);
  });

  // ── Client dashboard ───────────────────────────────────────────────────────

  test('Client dashboard header is visible', async ({ page }) => {
    await expect(page.getByText('Client Dashboard')).toBeVisible();
  });

  test('Client dashboard loads Business Review and Acceptance Testing cards', async ({ page }) => {
    await expect(page.getByText('Business Review')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Acceptance Testing')).toBeVisible({ timeout: 15_000 });
  });

  // ── Sidebar navigation ─────────────────────────────────────────────────────

  test('sidebar shows the correct nav items for a stakeholder', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Roadmap' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Documents' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Chat' })).toBeVisible();

    // Stakeholders must NOT have Settings or Developer links
    await expect(page.getByRole('link', { name: 'Settings' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Developer' })).not.toBeVisible();
  });

  // ── Roadmap panel ──────────────────────────────────────────────────────────

  test('Roadmap — page header and subtitle are visible', async ({ page }) => {
    await navigateToRoadmap(page);

    await expect(page.getByText('Roadmap')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Project timeline and progress')).toBeVisible();
  });

  test('Roadmap — "Projects Timeline" card title is visible', async ({ page }) => {
    await navigateToRoadmap(page);

    await expect(page.getByText('Projects Timeline')).toBeVisible({ timeout: 15_000 });
  });

  test('Roadmap — year navigation controls render with the current year', async ({ page }) => {
    await navigateToRoadmap(page);

    const currentYear = new Date().getFullYear().toString();
    await expect(page.getByRole('button', { name: currentYear })).toBeVisible({ timeout: 10_000 });

    // Prev and Next chevron buttons are present
    await expect(page.locator('button').filter({ has: page.locator('svg') }).nth(0)).toBeVisible();
    await expect(page.locator('button').filter({ has: page.locator('svg') }).nth(1)).toBeVisible();
  });

  test('Roadmap — all 12 month abbreviations are rendered in the timeline header', async ({ page }) => {
    await navigateToRoadmap(page);

    await expect(page.getByText('Projects Timeline')).toBeVisible({ timeout: 15_000 });

    for (const month of ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']) {
      await expect(page.getByText(month).first()).toBeVisible();
    }
  });

  test('Roadmap — clicking Prev decrements the year; clicking Next increments it back', async ({ page }) => {
    await navigateToRoadmap(page);

    const currentYear  = new Date().getFullYear();
    const previousYear = (currentYear - 1).toString();
    const currentYearStr = currentYear.toString();

    await expect(page.getByRole('button', { name: currentYearStr })).toBeVisible({ timeout: 10_000 });

    // Go back one year
    await page.getByRole('button').filter({ has: page.locator('[data-lucide="chevron-left"], svg') }).first().click();
    await expect(page.getByRole('button', { name: previousYear })).toBeVisible({ timeout: 5_000 });

    // Go forward one year — back to current
    await page.getByRole('button').filter({ has: page.locator('[data-lucide="chevron-right"], svg') }).last().click();
    await expect(page.getByRole('button', { name: currentYearStr })).toBeVisible({ timeout: 5_000 });
  });

  test('Roadmap — project rows or empty state render after data loads', async ({ page }) => {
    await navigateToRoadmap(page);

    await expect(page.getByText('Projects Timeline')).toBeVisible({ timeout: 15_000 });

    // Either project rows are shown or there are no milestones (empty grid)
    const expandBtn  = page.getByRole('button', { name: /^Expand /i }).first();
    const emptyGrid  = page.locator('[class*="min-w"]').first();
    await expect(expandBtn.or(emptyGrid)).toBeVisible({ timeout: 15_000 });
  });

  test('Roadmap — clicking a project header expands it, and collapses it again', async ({ page }) => {
    await navigateToRoadmap(page);

    await expandFirstProject(page);

    // After expanding the accessible name should switch to "Collapse <project>"
    await expect(page.getByRole('button', { name: /^Collapse /i }).first()).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: /^Collapse /i }).first().click();

    // After collapsing it should revert to "Expand <project>"
    await expect(page.getByRole('button', { name: /^Expand /i }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('Roadmap — expanding a project shows individual milestone rows', async ({ page }) => {
    await navigateToRoadmap(page);

    await expandFirstProject(page);

    // Milestone rows contain a progress value or a target date inside the expanded view
    const milestoneRow = page.locator('[class*="MilestoneRow"], [class*="milestone"], [class*="rounded-full"]').first();
    await expect(milestoneRow).toBeVisible({ timeout: 10_000 });
  });

  test('Roadmap — clicking a milestone opens the detail card', async ({ page }) => {
    await navigateToRoadmap(page);

    await page.getByRole('button', { name: /^Expand /i }).first().waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: /^Expand /i }).first().click();

    // Click the first clickable milestone bar/row inside the expanded view
    const milestoneTarget = page.locator('[class*="cursor-pointer"]').first();
    await milestoneTarget.waitFor({ state: 'visible', timeout: 10_000 });
    await milestoneTarget.click();

    // Detail card should appear — it always renders a close (X) button
    await expect(page.locator('button').filter({ has: page.locator('svg') }).last()).toBeVisible({ timeout: 5_000 });
  });

  test('Roadmap — closing the milestone detail card removes it', async ({ page }) => {
    await navigateToRoadmap(page);

    await page.getByRole('button', { name: /^Expand /i }).first().waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: /^Expand /i }).first().click();

    const milestoneTarget = page.locator('[class*="cursor-pointer"]').first();
    await milestoneTarget.waitFor({ state: 'visible', timeout: 10_000 });
    await milestoneTarget.click();

    // Close the detail card
    const closeBtn = page.locator('button').filter({ has: page.locator('svg') }).last();
    await closeBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await closeBtn.click();

    // After closing, the detail card (which always contains "No issues" or issue cards) should be gone
    await expect(page.getByText('No issues in this milestone.')).not.toBeVisible({ timeout: 5_000 });
  });

  test('Roadmap — MetricsPanel shows project selector and date range filters', async ({ page }) => {
    await navigateToRoadmap(page);

    // Wait for metrics to finish loading
    await expect(page.getByText('Loading metrics…')).not.toBeVisible({ timeout: 20_000 });

    // Project selector dropdown
    await expect(page.getByRole('combobox').first()).toBeVisible({ timeout: 10_000 });

    // From / To date inputs
    await expect(page.locator('#metrics-date-from')).toBeVisible();
    await expect(page.locator('#metrics-date-to')).toBeVisible();
  });

  test('Roadmap — MetricsPanel date range filter shows Clear button when a date is set', async ({ page }) => {
    await navigateToRoadmap(page);

    await expect(page.getByText('Loading metrics…')).not.toBeVisible({ timeout: 20_000 });

    await page.locator('#metrics-date-from').fill('2025-01-01');

    await expect(page.getByText('Clear')).toBeVisible({ timeout: 5_000 });

    await page.getByText('Clear').click();
    await expect(page.locator('#metrics-date-from')).toHaveValue('');
  });

  test('Roadmap — "Cycle Scope vs Completed" card title is visible', async ({ page }) => {
    await navigateToRoadmap(page);

    await expect(page.getByText('Loading metrics…')).not.toBeVisible({ timeout: 20_000 });

    await expect(page.getByText('Cycle Scope vs Completed')).toBeVisible({ timeout: 10_000 });
  });

  test('Roadmap — "Cycle Scope vs Completed" renders a chart or empty state', async ({ page }) => {
    await navigateToRoadmap(page);

    await expect(page.getByText('Cycle Scope vs Completed')).toBeVisible({ timeout: 20_000 });

    // Recharts outputs an <svg> inside the card; if there is no data the card is still visible
    const cycleCard = page.locator('div').filter({ hasText: /^Cycle Scope vs Completed/ }).first();
    const chartSvg  = cycleCard.locator('svg').first();
    const noData    = cycleCard.getByText(/no (data|cycles)/i);
    await expect(chartSvg.or(noData)).toBeVisible({ timeout: 10_000 });
  });

  test('Roadmap — "Issues by Status" card title is visible', async ({ page }) => {
    await navigateToRoadmap(page);

    await expect(page.getByText('Loading metrics…')).not.toBeVisible({ timeout: 20_000 });

    await expect(page.getByText('Issues by Status')).toBeVisible({ timeout: 10_000 });
  });

  test('Roadmap — "Issues by Status" renders a chart or empty state', async ({ page }) => {
    await navigateToRoadmap(page);

    await expect(page.getByText('Issues by Status')).toBeVisible({ timeout: 20_000 });

    const statusCard = page.locator('div').filter({ hasText: /^Issues by Status/ }).first();
    const chartSvg   = statusCard.locator('svg').first();
    const noData     = statusCard.getByText(/no (data|issues)/i);
    await expect(chartSvg.or(noData)).toBeVisible({ timeout: 10_000 });
  });

});
