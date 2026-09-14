import { test, expect } from '@playwright/test';
import { performLogin } from './helpers';

async function loginAsStakeholder(page: any) {
  const email    = process.env.TEST_HOLDER_EMAIL;
  const password = process.env.TEST_HOLDER_PASSWORD;

  if (!email || !password) {
    test.skip(true, 'TEST_HOLDER_EMAIL / TEST_HOLDER_PASSWORD not set in .env.test');
  }

  await performLogin(page, email!, password!, '/dashboard');
}

async function navigateToRoadmap(page: any) {
  await page.getByRole('link', { name: 'Monitor' }).click();
  await page.waitForURL('**/monitor', { timeout: 10_000 });
}

// The Monitor page can also have the SDLC Metrics panel pinned above the
// roadmap, and each of its stat cards has its own "Expand <metric>" toggle
// (e.g. "Expand Deploy Frequency") — an unscoped page-wide search for
// "Expand ..." can match one of those instead of a project row. Scoping to
// the "Projects Timeline" card avoids the collision.
function timelineCard(page: any) {
  return page.locator('div').filter({ hasText: /^Projects Timeline/ }).first();
}

async function expandFirstProject(page: any) {
  const expandBtn = timelineCard(page).getByRole('button', { name: /^Expand /i }).first();
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

    await performLogin(page, email!, password!, '/dashboard');
    expect(page.url()).toContain('/dashboard');
  });

});

// ── Panel tests (require login) ───────────────────────────────────────────────

test.describe('Stakeholder — panels', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsStakeholder(page);
  });

  // ── Client dashboard ───────────────────────────────────────────────────────

  test('Client dashboard header is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  });

  test('Client dashboard loads Business Review and Acceptance Testing cards', async ({ page }) => {
    // The dashboard is now a per-user pinned-panel board (see
    // lib/pinnable-panels.ts) rather than a fixed layout — what's pinned is
    // persisted account state, so seed the defaults first to make this
    // deterministic regardless of what this test account already has pinned.
    const addDefaultsBtn = page.getByRole('button', { name: 'Add default panels' });
    if (await addDefaultsBtn.isVisible().catch(() => false)) {
      await addDefaultsBtn.click();
    }
    // Panel headings specifically — once seeded, "Business Review" and
    // "Acceptance Testing" also appear as per-issue status badges inside the
    // panels themselves, which would otherwise collide with a plain getByText.
    await expect(page.getByRole('heading', { name: 'Business Review' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Acceptance Testing' })).toBeVisible({ timeout: 15_000 });
  });

  // ── Sidebar navigation ─────────────────────────────────────────────────────

  test('sidebar shows the correct nav items for a stakeholder', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Monitor' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Documents' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Chat' })).toBeVisible();

    // Stakeholders must NOT have Settings or Developer links
    await expect(page.getByRole('link', { name: 'Settings' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Developer' })).not.toBeVisible();
  });

  // ── Roadmap panel ──────────────────────────────────────────────────────────

  test('Roadmap — page header and subtitle are visible', async ({ page }) => {
    await navigateToRoadmap(page);

    await expect(page.getByRole('heading', { name: 'Monitor', level: 1 })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Project timeline and progress')).toBeVisible();
  });

  test('Roadmap — "Projects Timeline" card title is visible', async ({ page }) => {
    await navigateToRoadmap(page);

    await expect(page.getByText('Projects Timeline')).toBeVisible({ timeout: 15_000 });
  });

  // The timeline used to page by calendar year over a fixed 12-month grid.
  // It's now a 5-cycle sliding window over the team's real Linear cycles
  // (see roadmap-timeline.tsx's `allBuckets`/`WINDOW_SIZE`), with columns
  // labelled "#<cycle number>" instead of month names — there's no "current
  // year" concept anymore.

  test('Roadmap — cycle navigation controls render with cycle column labels', async ({ page }) => {
    await navigateToRoadmap(page);
    await expect(page.getByText('Projects Timeline')).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('button', { name: 'Show earlier cycles' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Show later cycles' })).toBeVisible();

    // At least one "#<number>" cycle column label is rendered.
    await expect(page.locator('div').filter({ hasText: /^#\d+$/ }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('Roadmap — clicking the earlier/later cycle arrows shifts the visible window', async ({ page }) => {
    await navigateToRoadmap(page);
    await expect(page.getByText('Projects Timeline')).toBeVisible({ timeout: 15_000 });

    const bucketLabels = () =>
      page.locator('div').filter({ hasText: /^#\d+$/ }).allTextContents();

    await expect.poll(bucketLabels, { timeout: 10_000 }).not.toHaveLength(0);
    const before = await bucketLabels();

    const prevBtn = page.getByRole('button', { name: 'Show earlier cycles' });
    await expect(prevBtn).toBeEnabled({ timeout: 5_000 });
    await prevBtn.click();
    await expect.poll(bucketLabels).not.toEqual(before);

    // Going forward the same number of steps returns to the original window.
    await page.getByRole('button', { name: 'Show later cycles' }).click();
    await expect.poll(bucketLabels).toEqual(before);
  });

  test('Roadmap — project rows or empty state render after data loads', async ({ page }) => {
    await navigateToRoadmap(page);

    await expect(page.getByText('Projects Timeline')).toBeVisible({ timeout: 15_000 });

    // Either project rows are shown, or the team has no Linear cycles at all
    // (see roadmap-timeline.tsx's "No cycles found for this team." branch).
    const expandBtn = timelineCard(page).getByRole('button', { name: /^Expand /i }).first();
    const emptyState = page.getByText('No cycles found for this team.');
    await expect(expandBtn.or(emptyState)).toBeVisible({ timeout: 15_000 });
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
    await expandFirstProject(page);

    // Click the first clickable cycle-bar cell inside the expanded project's
    // milestone rows (components/roadmap/ProjectSummaryBar.tsx).
    const milestoneTarget = timelineCard(page).locator('[class*="cursor-pointer"]').first();
    await milestoneTarget.waitFor({ state: 'visible', timeout: 10_000 });
    await milestoneTarget.click();

    // Selecting a cycle/milestone always renders a "cycle details" card with
    // a close (X) button — see roadmap-timeline.tsx's `selection` block.
    await expect(page.getByRole('button', { name: 'Close cycle details' })).toBeVisible({ timeout: 5_000 });
  });

  test('Roadmap — closing the milestone detail card removes it', async ({ page }) => {
    await navigateToRoadmap(page);
    await expandFirstProject(page);

    const milestoneTarget = timelineCard(page).locator('[class*="cursor-pointer"]').first();
    await milestoneTarget.waitFor({ state: 'visible', timeout: 10_000 });
    await milestoneTarget.click();

    const closeBtn = page.getByRole('button', { name: 'Close cycle details' });
    await closeBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await closeBtn.click();

    await expect(closeBtn).not.toBeVisible({ timeout: 5_000 });
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
