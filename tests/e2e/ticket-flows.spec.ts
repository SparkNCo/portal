import { test, expect, type Page, type Request } from '@playwright/test';
import { fillLoginForm } from './helpers';

// The client's core ticket flows, as a customer: Request a Feature, Report a
// Bug, answering a Business Review question, and recording a UAT result.
//
// Nothing here reaches Linear or writes to the database. Every write these
// flows make (create issue, answer, UAT result, marking a ticket seen) is
// answered by the test with fixed data, after checking what the page sent.
// The tickets the modal opens are fixtures too. Any other write the page
// tries is blocked and fails the test (see guardWrites), so a new write added
// to these flows later can't slip through to production unnoticed.
//
// Run on its own: npx playwright test --project=tickets

type Captured = { url: string; method: string; body: any };

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

// Blocks every write to the edge functions or the database that a test
// didn't mock on purpose, and remembers it. Auth (sign-in) is left alone.
// Registered first: routes added later (the mocks) take precedence.
async function guardWrites(page: Page): Promise<Captured[]> {
  const blocked: Captured[] = [];
  const handler = async (route: any, request: Request) => {
    if (!WRITE_METHODS.has(request.method())) {
      return route.fallback();
    }
    blocked.push({ url: request.url(), method: request.method(), body: request.postData() });
    return route.fulfill({ status: 418, contentType: 'application/json', body: '{"error":"blocked by test"}' });
  };
  await page.route('**/functions/v1/**', handler);
  await page.route('**/rest/v1/**', handler);
  return blocked;
}

// Replies to `method url` with `body`, and records what the page sent.
async function mockJson(page: Page, url: string, method: string, body: unknown, sink?: Captured[]) {
  await page.route(url, async (route, request) => {
    if (request.method() !== method) {
      return route.fallback();
    }
    sink?.push({ url: request.url(), method, body: request.postDataJSON?.() ?? null });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function signInAsCustomer(page: Page): Promise<string> {
  const email = process.env.TEST_CUSTOMER_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) test.skip(true, 'TEST_CUSTOMER_EMAIL / TEST_PASSWORD not set');
  await page.goto('/');
  await fillLoginForm(page, email!, password!);
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
  return new URL(page.url()).pathname.split('/')[1]!;
}

// A ticket as GET /issues returns it, with what the list and modal read.
function fixtureIssue(id: string, state: 'Business Review' | 'UAT', title: string) {
  const now = new Date().toISOString();
  return {
    id,
    identifier: 'E2E-1',
    branchName: 'feat/e2e-1-fixture',
    title,
    description: 'Fixture ticket for the e2e ticket flows.',
    priorityLabel: 'Medium',
    state: { name: state },
    labels: { nodes: [] },
    project: { id: 'e2e-project', name: 'E2E Project' },
    cycle: null,
    comments: { nodes: [] },
    attachments: { nodes: [] },
    createdAt: now,
    updatedAt: now,
  };
}

// The ticket lists, the deep-linked ticket and the modal's side requests,
// all answered with fixtures (reads included, so the test doesn't depend on
// what's in Linear today).
async function mockTicket(page: Page, issue: ReturnType<typeof fixtureIssue>) {
  await page.route('**/functions/v1/issues?*', (route, request) =>
    request.method() === 'GET'
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([issue]) })
      : route.fallback(),
  );
  await mockJson(page, '**/functions/v1/issues/by-id?*', 'GET', issue);
  await mockJson(page, '**/functions/v1/issues/attachments?*', 'GET', []);
  // Opening a ticket marks it seen (a write to issue_views): answered here.
  await mockJson(page, '**/functions/v1/issues/seen', 'POST', { ok: true });
}

let blockedWrites: Captured[] = [];

test.beforeEach(async ({ page }) => {
  blockedWrites = await guardWrites(page);
});

test.afterEach(() => {
  // Every write a flow makes has to be mocked on purpose.
  expect(blockedWrites, `Unmocked writes reached the network:\n${JSON.stringify(blockedWrites, null, 2)}`).toEqual([]);
});

// ── Request a Feature / Report a Bug ─────────────────────────────────────────

test.describe('Creating tickets', () => {
  test('Request a Feature sends the title, description and criteria, and confirms with the new ticket', async ({ page }) => {
    const created: Captured[] = [];
    await mockJson(page, '**/functions/v1/issues/projects?*', 'GET', []);
    await mockJson(page, '**/functions/v1/issues/similar?*', 'GET', []);
    await mockJson(page, '**/functions/v1/issues/create', 'POST', { issue: { id: 'new-1', identifier: 'E2E-101' } }, created);

    const slug = await signInAsCustomer(page);
    await page.goto(`/${slug}/build`);

    await page.locator('#issue-title').fill('E2E: export the roadmap as PDF');
    await page.getByRole('button', { name: 'Continue' }).first().click();
    await page.getByLabel('Description').first().click();
    await page.keyboard.type('Let clients download the roadmap.');
    await page.getByLabel('Criterion 1').fill('A PDF downloads with every milestone');
    await page.getByRole('button', { name: 'Submit Feature Request' }).click();

    await expect(page.getByText('Feature request submitted: E2E-101')).toBeVisible({ timeout: 15_000 });
    expect(created).toHaveLength(1);
    const sent = created[0]!.body;
    expect(sent).toMatchObject({
      title: 'E2E: export the roadmap as PDF',
      type: 'feature',
      slug,
      priority: 'medium',
      requestedBy: process.env.TEST_CUSTOMER_EMAIL,
    });
    expect(sent.description).toContain('### Feature Description');
    expect(sent.description).toContain('Let clients download the roadmap.');
    expect(sent.description).toContain('### Criteria\n- A PDF downloads with every milestone');
    expect(sent.projectId).toBeUndefined();
  });

  test('Report a Bug sends the steps and expected/actual behavior, and confirms with the new ticket', async ({ page }) => {
    const created: Captured[] = [];
    await mockJson(page, '**/functions/v1/issues/projects?*', 'GET', []);
    await mockJson(page, '**/functions/v1/issues/similar?*', 'GET', []);
    await mockJson(page, '**/functions/v1/issues/create', 'POST', { issue: { id: 'new-2', identifier: 'E2E-202' } }, created);

    const slug = await signInAsCustomer(page);
    await page.goto(`/${slug}/bugs`);

    await page.locator('#issue-title').fill('E2E: login button does nothing');
    await page.getByRole('button', { name: 'Continue' }).first().click();
    await page.getByLabel('Step 1').fill('Open the login page');
    await page.getByLabel('Expected').first().click();
    await page.keyboard.type('I am signed in');
    await page.getByLabel('Actual').first().click();
    await page.keyboard.type('Nothing happens');
    await page.getByRole('button', { name: 'Submit Bug Report' }).click();

    await expect(page.getByText('Bug reported: E2E-202')).toBeVisible({ timeout: 15_000 });
    expect(created).toHaveLength(1);
    const sent = created[0]!.body;
    expect(sent).toMatchObject({ title: 'E2E: login button does nothing', type: 'bug', slug });
    expect(sent.description).toContain('### Steps to Reproduce\n1. Open the login page');
    expect(sent.description).toContain('### Expected Behavior\nI am signed in');
    expect(sent.description).toContain('### Actual Behavior\nNothing happens');
  });

  test('a failed create says so and keeps what was typed', async ({ page }) => {
    await mockJson(page, '**/functions/v1/issues/projects?*', 'GET', []);
    await mockJson(page, '**/functions/v1/issues/similar?*', 'GET', []);
    await page.route('**/functions/v1/issues/create', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Linear is down"}' }),
    );

    const slug = await signInAsCustomer(page);
    await page.goto(`/${slug}/build`);
    await page.locator('#issue-title').fill('E2E: keep my text');
    await page.getByRole('button', { name: 'Continue' }).first().click();
    await page.getByRole('button', { name: 'Submit Feature Request' }).click();

    await expect(page.getByText('Failed to submit feature request. Please try again.')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#issue-title')).toHaveValue('E2E: keep my text');
  });
});

// ── Business Review: answering a question ────────────────────────────────────

test.describe('Business Review', () => {
  test('the client answers an open question, and the decision is sent and shown', async ({ page }) => {
    const issue = fixtureIssue('e2e-br-issue', 'Business Review', 'E2E: Business Review ticket');
    const question = {
      id: 'e2e-decision-1',
      issue_id: issue.id,
      owner_email: 'dev@example.com',
      question: 'Should the export include archived milestones?',
      decision: null,
      decision_by: null,
      decided_at: null,
      posted_to_linear: false,
      created_at: new Date().toISOString(),
      type: 'question',
    };
    const answered: Captured[] = [];
    await mockTicket(page, issue);
    await mockJson(page, '**/rest/v1/decisions?*', 'GET', [question]);
    await mockJson(page, '**/functions/v1/test-executions?*', 'GET', []);
    await page.route('**/functions/v1/issues/decision', async (route, request) => {
      if (request.method() !== 'PATCH') {
        return route.fallback();
      }
      const body = request.postDataJSON();
      answered.push({ url: request.url(), method: 'PATCH', body });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...question, decision: body.decision, decision_by: body.decisionEmail, decided_at: new Date().toISOString() }),
      });
    });

    const slug = await signInAsCustomer(page);
    await page.goto(`/${slug}/build?issueId=${issue.id}&tab=decisions`);

    await expect(page.getByText('Should the export include archived milestones?')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Submit your decision' }).click();
    await page.getByLabel('Your decision').click();
    await page.keyboard.type('No, only active ones.');
    await page.getByRole('button', { name: 'Submit decision' }).click();

    await expect(page.getByText('No, only active ones.')).toBeVisible({ timeout: 15_000 });
    expect(answered).toHaveLength(1);
    expect(answered[0]!.body).toMatchObject({
      decisionId: question.id,
      decision: 'No, only active ones.',
      decisionEmail: process.env.TEST_CUSTOMER_EMAIL,
      slug,
    });
  });
});

// ── UAT: recording the client's result ───────────────────────────────────────

test.describe('Acceptance testing (UAT)', () => {
  test('the client records a UAT result for an approved test case', async ({ page }) => {
    const issue = fixtureIssue('e2e-uat-issue', 'UAT', 'E2E: UAT ticket');
    const execution = {
      id: 'e2e-execution-1',
      test_id: 'e2e-test-1',
      issue_id: issue.id,
      expected: 'The PDF lists every milestone',
      status: 'approved',
      results: [],
      created_by: 'dev@example.com',
      test: { title: 'Export the roadmap', steps: [{ order: 1, description: 'Click Export' }] },
    };
    const recorded: Captured[] = [];
    await mockTicket(page, issue);
    await mockJson(page, '**/rest/v1/decisions?*', 'GET', []);
    await mockJson(page, '**/functions/v1/test-executions?*', 'GET', [execution]);
    await page.route('**/functions/v1/test-executions/result', async (route, request) => {
      if (request.method() !== 'PATCH') {
        return route.fallback();
      }
      const body = request.postDataJSON();
      recorded.push({ url: request.url(), method: 'PATCH', body });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...execution, results: [{ text: body.result, recorded_by: body.recorded_by, kind: 'uat', recorded_at: new Date().toISOString() }] }),
      });
    });

    const slug = await signInAsCustomer(page);
    await page.goto(`/${slug}/build?issueId=${issue.id}&tab=tests`);

    await expect(page.getByText('Export the roadmap')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Record UAT' }).click();
    await page.getByPlaceholder('Describe what actually happened…').fill('Works: all milestones are in the PDF.');
    await page.getByRole('button', { name: 'Save UAT' }).click();

    await expect(page.getByText('Works: all milestones are in the PDF.')).toBeVisible({ timeout: 15_000 });
    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.body).toMatchObject({
      execution_id: execution.id,
      result: 'Works: all milestones are in the PDF.',
      recorded_by: process.env.TEST_CUSTOMER_EMAIL,
      kind: 'uat',
      attachments: [],
    });
  });
});
