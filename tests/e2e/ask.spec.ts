import { test, expect, type Page, type Request } from '@playwright/test';
import { fillLoginForm } from './helpers';

// The global query on the Dashboard (SPA-582), as a customer. The `ask`
// function is answered by the test with fixed data, so no AI credits are
// spent and nothing is written. Any other write the page tries is blocked
// and fails the test. Access rules and the real function are covered by
// tests/unit/ask.spec.ts and the function's own checks.
//
// Run on its own: npx playwright test --project=ask

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

let blockedWrites: { url: string; method: string }[] = [];

test.beforeEach(async ({ page }) => {
  blockedWrites = [];
  const block = async (route: any, request: Request) => {
    if (!WRITE_METHODS.has(request.method()) || request.url().includes('/functions/v1/ask')) {
      return route.fallback();
    }
    blockedWrites.push({ url: request.url(), method: request.method() });
    return route.fulfill({ status: 418, contentType: 'application/json', body: '{"error":"blocked by test"}' });
  };
  await page.route('**/functions/v1/**', block);
  await page.route('**/rest/v1/**', block);
});

test.afterEach(() => {
  expect(blockedWrites, `Unmocked writes reached the network:\n${JSON.stringify(blockedWrites, null, 2)}`).toEqual([]);
});

async function signInAsCustomer(page: Page): Promise<string> {
  const email = process.env.TEST_CUSTOMER_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) test.skip(true, 'TEST_CUSTOMER_EMAIL / TEST_PASSWORD not set');
  await page.goto('/');
  await fillLoginForm(page, email!, password!);
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
  return new URL(page.url()).pathname.split('/')[1]!;
}

// Answers POST /ask with `body` (after `delayMs`), remembering what was sent.
async function mockAsk(page: Page, status: number, body: unknown, delayMs = 0) {
  const sent: any[] = [];
  await page.route('**/functions/v1/ask', async (route, request) => {
    if (request.method() !== 'POST') return route.fallback();
    sent.push({ body: request.postDataJSON(), authorization: request.headers()['authorization'] });
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return sent;
}

const question = () => (page: Page) => page.getByLabel('Your question about this project');

test.describe('Ask about this project', () => {
  test('asks with the session, shows a loading state, then the answer and its sources', async ({ page }) => {
    const sent = await mockAsk(
      page,
      200,
      {
        question: 'Is there an email fallback?',
        found: true,
        answer: 'Yes. When Resend is not configured, emails go out through SMTP (Issue SPA-456).',
        sources: [
          { type: 'issue', id: 'linear-uuid-1', ref: 'SPA-456', title: 'Fallback to nodemailer', status: 'Done' },
          { type: 'document', id: '12', ref: '12', title: 'Email setup.md', status: null },
          { type: 'test', id: 'test-uuid-1', ref: 'test-uui', title: 'Sends the invite email', status: null },
        ],
      },
      800,
    );
    const slug = await signInAsCustomer(page);

    await question()(page).fill('Is there an email fallback?');
    await page.getByRole('button', { name: 'Ask' }).click();

    await expect(page.getByRole('progressbar', { name: /Looking through the project/ })).toBeVisible();
    await expect(page.getByText('Yes. When Resend is not configured, emails go out through SMTP (Issue SPA-456).')).toBeVisible({ timeout: 15_000 });

    const issueLink = page.getByRole('link', { name: /Issue SPA-456.*Fallback to nodemailer/ });
    await expect(issueLink).toHaveAttribute('href', `/${slug.toLowerCase()}/build?issueId=linear-uuid-1`);
    await expect(page.getByRole('link', { name: /Document.*Email setup\.md/ })).toHaveAttribute('href', `/${slug.toLowerCase()}/documents`);
    // Test cases have no page to open: listed, not linked.
    await expect(page.getByText('Sends the invite email')).toBeVisible();
    await expect(page.getByRole('link', { name: /Sends the invite email/ })).toHaveCount(0);

    expect(sent).toHaveLength(1);
    expect(sent[0].body).toEqual({ slug, question: 'Is there an email fallback?' });
    // The signed-in user's session, not the public key: the function checks
    // access with it. A session token says who it is (role "authenticated",
    // the user's email); the public key says "anon".
    const token = String(sent[0].authorization).replace(/^Bearer /, '');
    const claims = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString());
    expect(claims.role).toBe('authenticated');
    expect(claims.email).toBe(process.env.TEST_CUSTOMER_EMAIL);
  });

  test('nothing relevant: says so clearly', async ({ page }) => {
    await mockAsk(page, 200, { question: 'Banana bread?', found: false, answer: '', sources: [] });
    await signInAsCustomer(page);
    await question()(page).fill('Banana bread?');
    await question()(page).press('Enter');
    await expect(page.getByText("Nothing in this project's documents, test cases or issues covers that.", { exact: false })).toBeVisible({ timeout: 15_000 });
  });

  test('AI busy or no access: the server’s message is shown', async ({ page }) => {
    await mockAsk(page, 503, { error: 'The AI model is busy right now (high demand). Please try again in a minute.' });
    await signInAsCustomer(page);
    await question()(page).fill('Anything');
    await page.getByRole('button', { name: 'Ask' }).click();
    // By text: Next.js adds its own role="alert" element (the route announcer).
    await expect(page.getByRole('alert').filter({ hasText: 'The AI model is busy right now' })).toBeVisible({ timeout: 15_000 });
  });

  test('Ask is disabled until there is a question', async ({ page }) => {
    await mockAsk(page, 200, { question: '', found: false, answer: '', sources: [] });
    await signInAsCustomer(page);
    await expect(page.getByRole('button', { name: 'Ask' })).toBeDisabled();
    await question()(page).fill('   ');
    await expect(page.getByRole('button', { name: 'Ask' })).toBeDisabled();
    await question()(page).fill('What is next?');
    await expect(page.getByRole('button', { name: 'Ask' })).toBeEnabled();
  });
});
