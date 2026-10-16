import { test, expect, type Page, type Route } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { performLogin } from './helpers';
import { ANON_KEY, SUPABASE_URL } from './notifications.helpers';

// Query (SPA-487..492). The page tests answer the `data-sources` and `query`
// edge functions with fixed data, so they never reach a client database or
// spend AI credits. The last block calls the real functions to check that
// only admins get in. Run on its own: npx playwright test --project=query

const SLUG = 'spark-portal';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const CUSTOMER_EMAIL = process.env.TEST_CUSTOMER_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

const SHOP = {
  id: '11111111-1111-4111-8111-111111111111',
  customer_id: '22222222-2222-4222-8222-222222222222',
  name: 'Shop',
  type: 'postgres',
  host: 'db.example.com',
  port: 5432,
  database_name: 'shop',
  username: 'reader',
  ssl: true,
  schema_path: '22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111.json',
  schema_refreshed_at: '2026-10-16T12:00:00.000Z',
  schema_error: null,
  created_at: '2026-10-16T12:00:00.000Z',
  updated_at: '2026-10-16T12:00:00.000Z',
};

const STRUCTURE = {
  dataSourceId: SHOP.id,
  database: 'shop',
  refreshedAt: SHOP.schema_refreshed_at,
  tables: [
    {
      schema: 'public',
      name: 'orders',
      kind: 'table',
      comment: null,
      columns: [
        { name: 'id', type: 'integer', nullable: false, comment: null },
        { name: 'customer_id', type: 'integer', nullable: false, comment: null },
        { name: 'status', type: 'order_status', nullable: false, comment: null },
      ],
      primaryKey: ['id'],
      foreignKeys: [{ columns: ['customer_id'], references: { schema: 'public', table: 'customers', columns: ['id'] } }],
    },
  ],
  enums: [{ schema: 'public', name: 'order_status', values: ['paid', 'cancelled'] }],
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  });

// Answers the data-sources function from an in-memory list of connections.
async function mockDataSources(page: Page, initial: object[]) {
  let connections = [...initial];
  const calls: { method: string; path: string; body: any }[] = [];

  await page.route(
    (url) => url.pathname.includes('/functions/v1/data-sources'),
    async (route) => {
      const request = route.request();
      const method = request.method();
      if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
      const path = new URL(request.url()).pathname.split('/data-sources')[1] ?? '';
      const body = request.postDataJSON?.() ?? null;
      calls.push({ method, path, body });

      if (method === 'GET' && path === '') return json(route, connections);
      if (method === 'GET' && path.endsWith('/structure')) return json(route, STRUCTURE);
      if (method === 'POST' && path === '/test') {
        return json(route, body?.password === 'wrong' ? { ok: false, error: 'Wrong username or password.' } : { ok: true });
      }
      if (method === 'POST' && path === '') {
        const created = { ...SHOP, name: body.name, host: body.host, username: body.username, database_name: body.database };
        connections = [...connections, created];
        return json(route, created, 201);
      }
      if (method === 'DELETE') {
        connections = connections.filter((c: any) => !path.includes(c.id));
        return json(route, { deleted: true });
      }
      return json(route, { error: 'Not mocked' }, 500);
    },
  );
  return calls;
}

async function openQueryPage(page: Page) {
  await performLogin(page, ADMIN_EMAIL!, PASSWORD!, '/users');
  await page.goto(`/${SLUG}/query`);
  await expect(page.getByRole('heading', { name: 'Query', level: 1 })).toBeVisible({ timeout: 15_000 });
}

test.describe('Query — page (mocked functions)', () => {
  test.beforeEach(() => {
    test.skip(!ADMIN_EMAIL || !PASSWORD, 'TEST_ADMIN_EMAIL / TEST_PASSWORD not set in .env.test');
  });

  test('admins see Query in the menu, and a client with no connections gets the empty state', async ({ page }) => {
    await mockDataSources(page, []);
    await openQueryPage(page);

    await expect(page.locator('aside nav').getByRole('link', { name: 'Query', exact: true })).toHaveAttribute(
      'href',
      new RegExp(`/${SLUG}/query$`),
    );
    await expect(page.getByText('No databases connected yet')).toBeVisible();
  });

  test('connecting a database: Test connection reports back, Save lists it', async ({ page }) => {
    const calls = await mockDataSources(page, []);
    await openQueryPage(page);

    await page.getByRole('button', { name: 'Connect database' }).click();
    const dialog = page.getByRole('dialog', { name: 'Connect database' });
    await dialog.getByLabel('Name', { exact: true }).fill('Shop');
    await dialog.getByLabel('Host').fill('db.example.com');
    await dialog.getByLabel('Database', { exact: true }).fill('shop');
    await dialog.getByLabel('Username', { exact: true }).fill('reader');
    await dialog.getByLabel('Password').fill('wrong');

    await dialog.getByRole('button', { name: 'Test connection' }).click();
    await expect(dialog.getByText('Wrong username or password.')).toBeVisible();

    // Editing a field clears the old result.
    await dialog.getByLabel('Password').fill('right');
    await expect(dialog.getByText('Wrong username or password.')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Test connection' }).click();
    await expect(dialog.getByText('Connected successfully.')).toBeVisible();

    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Connected "Shop"')).toBeVisible();
    await expect(dialog).toHaveCount(0);

    const created = calls.find((c) => c.method === 'POST' && c.path === '');
    expect(created?.body).toMatchObject({ slug: SLUG, name: 'Shop', host: 'db.example.com', port: 5432, ssl: true });
    await expect(page.getByText('reader@db.example.com:5432/shop')).toBeVisible();
  });

  // SQL Server is written but waits for Supabase's edge runtime to reach
  // Deno 2.7 (DATABASE_ENGINES in lib/data-sources-api.ts).
  test('SQL Server is listed but can’t be picked yet', async ({ page }) => {
    await mockDataSources(page, []);
    await openQueryPage(page);

    await page.getByRole('button', { name: 'Connect database' }).click();
    const dialog = page.getByRole('dialog', { name: 'Connect database' });
    await dialog.getByRole('combobox', { name: 'Database type' }).click();
    const sqlServer = page.getByRole('option', { name: /SQL Server/ });
    await expect(sqlServer).toContainText('coming soon');
    await expect(sqlServer).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');
    await expect(dialog.getByLabel('Port')).toHaveValue('5432');
  });

  test('a connection shows its structure, tables first and columns on demand', async ({ page }) => {
    await mockDataSources(page, [SHOP]);
    await openQueryPage(page);

    await page.getByRole('button', { name: 'View structure' }).click();
    const orders = page.locator('details', { hasText: 'orders' });
    await expect(orders).toContainText('3 columns');
    await orders.locator('summary').click();
    await expect(orders).toContainText('customer_id');
    await expect(orders).toContainText('customers.id');
    await expect(orders).toContainText('paid, cancelled');
  });

  test('deleting asks first, then removes the connection', async ({ page }) => {
    const calls = await mockDataSources(page, [SHOP]);
    await openQueryPage(page);

    await page.getByRole('button', { name: 'Delete Shop' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText("The client's database itself isn't touched.");
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText('Deleted "Shop"')).toBeVisible();
    await expect(page.getByText('No databases connected yet')).toBeVisible();
    expect(calls.some((c) => c.method === 'DELETE' && c.path === `/${SHOP.id}`)).toBe(true);
  });

  test('asking a question shows the explanation, the SQL used and the rows', async ({ page }) => {
    await mockDataSources(page, [SHOP]);
    let asked: any = null;
    await page.route('**/functions/v1/query', async (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
      asked = route.request().postDataJSON();
      return json(route, {
        question: asked.question,
        explanation: 'Los 2 productos más caros.',
        sql: 'SELECT name, unit_price FROM public.products ORDER BY unit_price DESC LIMIT 2',
        columns: ['name', 'unit_price'],
        rows: [
          ['4K monitor', '449.00'],
          ['27" monitor', '279.00'],
        ],
        truncated: false,
      });
    });
    await openQueryPage(page);

    await page.getByLabel(/Question/).fill('¿Cuáles son los 2 productos más caros?');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();

    await expect(page.getByText('Los 2 productos más caros.')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'unit_price' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '4K monitor' })).toBeVisible();
    await expect(page.getByText('2 rows')).toBeVisible();
    await page.getByText('SQL used').click();
    await expect(page.getByText('ORDER BY unit_price DESC LIMIT 2')).toBeVisible();
    expect(asked).toEqual({ dataSourceId: SHOP.id, question: '¿Cuáles son los 2 productos más caros?' });
  });

  test('a question that can’t be run shows why, and the SQL it would have used', async ({ page }) => {
    await mockDataSources(page, [SHOP]);
    await page.route('**/functions/v1/query', (route) =>
      route.request().method() === 'OPTIONS'
        ? route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } })
        : json(route, {
            question: 'Borrá los pedidos cancelados',
            explanation: '',
            sql: "DELETE FROM public.orders WHERE status = 'cancelled'",
            error: "The generated SQL isn't a SELECT query, so it wasn't run.",
          }),
    );
    await openQueryPage(page);

    await page.getByLabel(/Question/).fill('Borrá los pedidos cancelados');
    await page.getByLabel(/Question/).press('Enter');

    await expect(page.getByRole('alert').filter({ hasText: "isn't a SELECT query, so it wasn't run" })).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
    await page.getByText('SQL used').click();
    await expect(page.getByText("DELETE FROM public.orders WHERE status = 'cancelled'")).toBeVisible();
  });
});

test.describe('Query — access', () => {
  test('a customer opening the Query page is sent back to their dashboard', async ({ page }) => {
    test.skip(!CUSTOMER_EMAIL || !PASSWORD, 'TEST_CUSTOMER_EMAIL / TEST_PASSWORD not set in .env.test');
    await performLogin(page, CUSTOMER_EMAIL!, PASSWORD!, '/dashboard');
    const slug = new URL(page.url()).pathname.split('/')[1];

    await page.goto(`/${slug}/query`);
    await page.waitForURL(`**/${slug}/dashboard`, { timeout: 15_000 });
    await expect(page.locator('aside nav').getByRole('link', { name: 'Query' })).toHaveCount(0);
  });

  // The real functions: without an admin session they answer nothing.
  test('the functions refuse anyone but an admin', async () => {
    test.skip(!CUSTOMER_EMAIL || !PASSWORD || !SUPABASE_URL || !ANON_KEY, 'Test credentials or Supabase keys missing');

    const call = (path: string, token: string, init: RequestInit = {}) =>
      fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
        ...init,
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

    // Only the public key — no one signed in.
    expect((await call(`data-sources?slug=${SLUG}`, ANON_KEY)).status).toBe(401);
    expect((await call('query', ANON_KEY, { method: 'POST', body: '{}' })).status).toBe(401);

    // Signed in, but as a customer.
    const auth = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email: CUSTOMER_EMAIL!, password: PASSWORD! });
    expect(error).toBeNull();
    const token = data.session!.access_token;
    expect((await call(`data-sources?slug=${SLUG}`, token)).status).toBe(403);
    expect((await call('query', token, { method: 'POST', body: '{}' })).status).toBe(403);
    await auth.auth.signOut();
  });
});
