import { test, expect, Browser, Page } from '@playwright/test';
import JSZip from 'jszip';
import { fillLoginForm } from './helpers';
import { db, deleteEvents, missingEnv, sinceNow } from './notifications.helpers';

// Documents end to end, through the UI, as each role: upload → preview →
// category → search → what other roles can do → delete; sharing; and the
// document request flow (request → claim → unassign → fulfill). Runs on
// Spark-Portal with the test users. Everything created is removed at the end
// (documents, their files, requests and the notifications they sent).

const SLUG = 'spark-portal';
const DOCS = `/${SLUG}/documents`;
const STAMP = `e2e-${Date.now()}`;
const BUCKET = 'documents_bucket';

const USERS = {
  admin: { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_PASSWORD!, home: '/users' },
  developer: { email: process.env.TEST_DEVELOPER_EMAIL!, password: process.env.TEST_PASSWORD!, home: '/developer' },
  customer: { email: process.env.TEST_CUSTOMER_EMAIL!, password: process.env.TEST_PASSWORD!, home: '/dashboard' },
};
type Role = keyof typeof USERS;

const since = sinceNow();
const createdRequestIds: string[] = [];

// Roomy: the first visit to each role's pages may wait on `next dev` compiling.
test.describe.configure({ mode: 'serial', timeout: 120_000 });

// One signed-in page per role, kept for the whole file.
const pages = {} as Record<Role, Page>;
async function as(browser: Browser, role: Role): Promise<Page> {
  if (!pages[role]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const { email, password, home } = USERS[role];
    // Not performLogin: its 15s wait isn't enough while `next dev` compiles a
    // role's first page.
    await page.goto('/');
    await fillLoginForm(page, email, password);
    await page.waitForURL(`**${home}`, { timeout: 60_000 });
    pages[role] = page;
  }
  return pages[role];
}

async function openDocuments(page: Page) {
  await page.goto(DOCS);
  await expect(page.getByText('Project Documents')).toBeVisible({ timeout: 20_000 });
}

// A document row, found by its name button ("Preview x.md" / "Open x.pdf").
function docButton(page: Page, name: string) {
  return page.getByRole('button', { name: new RegExp(`^(Preview|Open) ${escapeRegExp(name)}$`) }).first();
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function textFile(name: string, content: string) {
  return { name, mimeType: name.endsWith('.md') ? 'text/markdown' : 'text/plain', buffer: Buffer.from(content) };
}

// A minimal Word document with a heading and a paragraph.
async function docxFile(name: string, heading: string, paragraph: string) {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    'word/document.xml',
    '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${heading}</w:t></w:r></w:p>` +
      `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${paragraph}</w:t></w:r></w:p>` +
      '</w:body></w:document>',
  );
  return {
    name,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
  };
}

// Documents (and their files in storage) whose name has this run's stamp.
async function removeTestDocuments() {
  const { data: docs } = await db().from('documents').select('id, file_name').ilike('file_name', `%${STAMP}%`);
  if (docs?.length) {
    await db().from('document_permissions').delete().in('document_id', docs.map((d) => d.id));
    await db().from('documents').delete().in('id', docs.map((d) => d.id));
  }
  const files = await uploadsMatching(STAMP);
  if (files.length) await db().storage.from(BUCKET).remove(files);
}

// Paths under uploads/ whose name contains `text`. (Storage's own `search`
// option only matches name prefixes, and uploads start with a timestamp.)
async function uploadsMatching(text: string): Promise<string[]> {
  const { data, error } = await db().storage.from(BUCKET).list('uploads', { limit: 1000 });
  if (error) throw new Error(error.message);
  return (data ?? []).filter((f) => f.name.includes(text)).map((f) => `uploads/${f.name}`);
}

test.beforeAll(() => {
  const missing = missingEnv();
  expect(missing, `missing env (supabase/functions/.env or .env): ${missing.join(', ')}`).toEqual([]);
});

test.afterAll(async () => {
  test.setTimeout(60_000);
  await Promise.all(Object.values(pages).map((p) => p.context().close()));
  await removeTestDocuments();
  if (createdRequestIds.length) {
    await db().from('document_requests').delete().in('id', createdRequestIds);
  }
  await deleteEvents({ since, objectIds: createdRequestIds });
});

// ── Upload and manage ─────────────────────────────────────────────────────

test.describe('upload and manage a document', () => {
  const name = `notes-${STAMP}.md`;

  test('developer uploads a markdown file and it shows up in Project Documents', async ({ browser }) => {
    const page = await as(browser, 'developer');
    await openDocuments(page);

    await page.getByLabel('Upload document files').setInputFiles(
      textFile(name, `# Heading ${STAMP}\n\nSome **bold** text.\n\n- one\n- two\n`),
    );
    await expect(page.getByText('Uploaded Files')).toBeVisible();
    await expect(docButton(page, name)).toBeVisible({ timeout: 30_000 });
  });

  test('several files dropped at once each end up marked as uploaded', async ({ browser }) => {
    const page = await as(browser, 'developer');
    const names = ['a', 'b', 'c'].map((n) => `batch-${n}-${STAMP}.txt`);
    await page.getByLabel('Upload document files').setInputFiles(names.map((n) => textFile(n, `Batch ${n}`)));
    for (const n of names) {
      await expect(page.getByText(`${n} uploaded`, { exact: true })).toBeAttached({ timeout: 30_000 });
      await expect(page.getByText(`Uploading ${n}`, { exact: true })).toHaveCount(0);
    }
  });

  test('clicking it previews the rendered markdown', async ({ browser }) => {
    const page = await as(browser, 'developer');
    await docButton(page, name).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: `Heading ${STAMP}` })).toBeVisible({ timeout: 20_000 });
    await expect(dialog.locator('strong', { hasText: 'bold' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('changing its category moves it to that tab', async ({ browser }) => {
    const page = await as(browser, 'developer');
    await page.getByRole('button', { name: `Change category for ${name}` }).click();
    await page.getByRole('button', { name: 'Technical', exact: true }).last().click();

    await page.getByTestId('category-tab-technical').click();
    await expect(docButton(page, name)).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('category-tab-reports').click();
    await expect(docButton(page, name)).toHaveCount(0);
    await page.getByTestId('category-tab-all').click();
  });

  test('search finds it by name', async ({ browser }) => {
    const page = await as(browser, 'developer');
    await page.getByLabel('AI-powered document search').fill(STAMP);
    await expect(docButton(page, name)).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('AI-powered document search').fill('');
  });

  test('the customer sees it and can share or recategorize it, but not delete it', async ({ browser }) => {
    const page = await as(browser, 'customer');
    await openDocuments(page);
    await expect(docButton(page, name)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: `Share ${name}` })).toBeVisible();
    await expect(page.getByRole('button', { name: `Change category for ${name}` })).toBeVisible();
    await expect(page.getByRole('button', { name: `Download ${name}` })).toBeVisible();
    await expect(page.getByRole('button', { name: `Delete ${name}` })).toHaveCount(0);
    // Only admins can change a document's owner.
    await expect(page.getByRole('button', { name: `Change owner for ${name}` })).toHaveCount(0);
  });

  test('a Word document (.docx) previews as formatted text', async ({ browser }) => {
    const page = await as(browser, 'developer');
    const docx = `brief-${STAMP}.docx`;
    await page.getByLabel('Upload document files').setInputFiles(await docxFile(docx, `Brief ${STAMP}`, 'Important part'));
    await expect(docButton(page, docx)).toBeVisible({ timeout: 30_000 });
    await expect(docButton(page, docx)).toHaveAccessibleName(`Preview ${docx}`);

    await docButton(page, docx).click();
    const preview = page.getByTestId('docx-preview');
    await expect(preview.getByRole('heading', { name: `Brief ${STAMP}` })).toBeVisible({ timeout: 20_000 });
    await expect(preview.locator('strong', { hasText: 'Important part' })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('the owner deletes it; it disappears for everyone and its file leaves storage', async ({ browser }) => {
    const page = await as(browser, 'developer');
    await page.getByRole('button', { name: `Delete ${name}` }).click();
    await expect(docButton(page, name)).toHaveCount(0, { timeout: 15_000 });

    // Uploads are stored as uploads/<timestamp>-<name>.
    await expect
      .poll(async () => (await uploadsMatching(name)).length, {
        message: 'file still in documents_bucket',
        timeout: 15_000,
      })
      .toBe(0);

    const customer = await as(browser, 'customer');
    await customer.reload();
    await expect(customer.getByText('Project Documents')).toBeVisible({ timeout: 20_000 });
    await expect(customer.getByText('Loading documents…')).toHaveCount(0, { timeout: 20_000 });
    await expect(docButton(customer, name)).toHaveCount(0);
  });
});

// ── Sharing ──────────────────────────────────────────────────────────────

test.describe('sharing a document', () => {
  const name = `shared-${STAMP}.txt`;

  test('admin uploads: the client side already has access, and sharing with the developer gives them "Can view"', async ({ browser }) => {
    const page = await as(browser, 'admin');
    await openDocuments(page);
    await page.getByLabel('Upload document files').setInputFiles(textFile(name, `Shared ${STAMP}`));
    await expect(docButton(page, name)).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: `Share ${name}` }).click();
    const dialog = page.getByRole('dialog', { name: 'Share Document' });
    await expect(dialog.getByText('Loading people…')).toHaveCount(0, { timeout: 20_000 });

    const row = (email: string) => dialog.getByRole('listitem').filter({ hasText: email });
    // Uploads are shared with the customer automatically ("Can edit").
    await expect(row(USERS.customer.email)).toContainText('Can edit');
    await expect(row(USERS.customer.email).getByRole('checkbox')).toBeDisabled();

    // The developer isn't included automatically — pick them.
    const developer = row(USERS.developer.email);
    await expect(developer.getByRole('checkbox')).toBeEnabled();
    await developer.getByRole('checkbox').click();
    await dialog.getByRole('button', { name: 'Share with 1' }).click();
    await expect(page.getByText('Shared with 1 person')).toBeVisible({ timeout: 15_000 });
    await expect(dialog).not.toBeVisible();

    // Reopened, the developer is now listed as having access.
    await page.getByRole('button', { name: `Share ${name}` }).click();
    await expect(dialog.getByText('Loading people…')).toHaveCount(0, { timeout: 20_000 });
    await expect(row(USERS.developer.email)).toContainText('Can view', { timeout: 15_000 });
    await expect(row(USERS.developer.email).getByRole('checkbox')).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });

  test('admins can delete any document and change its owner', async ({ browser }) => {
    const page = await as(browser, 'admin');
    await expect(page.getByRole('button', { name: `Change owner for ${name}` })).toBeVisible();
    await page.getByRole('button', { name: `Delete ${name}` }).click();
    await expect(docButton(page, name)).toHaveCount(0, { timeout: 15_000 });
  });
});

// ── Document requests ─────────────────────────────────────────────────────

test.describe('document request flow', () => {
  const title = `Report ${STAMP}`;
  const deliveredName = `report-${STAMP}.txt`;
  const requestRow = (page: Page) =>
    page.locator('div.rounded-lg').filter({ has: page.getByText(title, { exact: true }) }).last();

  test('customer requests a document; it shows as Pending, and they can edit or delete it', async ({ browser }) => {
    const page = await as(browser, 'customer');
    await openDocuments(page);
    await page.getByRole('button', { name: 'Request Report or Documentation' }).click();
    const dialog = page.getByRole('dialog');
    const submit = dialog.getByRole('button', { name: 'Submit Request' });
    await expect(submit).toBeDisabled();
    await dialog.getByLabel('What Do You Need?').fill(title);
    await submit.click();
    await expect(page.getByText('Request submitted')).toBeVisible({ timeout: 15_000 });

    const row = requestRow(page);
    await expect(row).toContainText('Pending', { timeout: 15_000 });
    await expect(row.getByRole('button', { name: `Edit ${title}` })).toBeVisible();
    await expect(row.getByRole('button', { name: `Delete ${title}` })).toBeVisible();

    const { data } = await db().from('document_requests').select('id').eq('title', title).single();
    createdRequestIds.push(String(data!.id));
  });

  test('developer claims it; the customer can no longer edit it', async ({ browser }) => {
    const page = await as(browser, 'developer');
    await openDocuments(page);
    const row = requestRow(page);
    await row.getByRole('button', { name: 'Claim' }).click();
    await expect(row.getByRole('button', { name: 'Upload & Share' })).toBeVisible({ timeout: 15_000 });
    await expect(row.getByRole('button', { name: 'Unassign yourself from this request' })).toBeVisible();

    const customer = await as(browser, 'customer');
    await customer.reload();
    await expect(requestRow(customer)).toContainText('Claimed by', { timeout: 20_000 });
    await expect(requestRow(customer).getByRole('button', { name: `Edit ${title}` })).toHaveCount(0);
  });

  test('admin sees who claimed it and can unassign them', async ({ browser }) => {
    const page = await as(browser, 'admin');
    await openDocuments(page);
    const row = requestRow(page);
    await expect(row).toContainText('Claimed by', { timeout: 20_000 });
    await row.getByRole('button', { name: 'Unassign' }).click();
    await expect(row.getByRole('button', { name: 'Claim' })).toBeVisible({ timeout: 15_000 });
  });

  test('developer claims it again and delivers it; it moves to Requests Fulfilled', async ({ browser }) => {
    const page = await as(browser, 'developer');
    await page.reload();
    const row = requestRow(page);
    await row.getByRole('button', { name: 'Claim' }).click();
    await row.getByRole('button', { name: 'Upload & Share' }).click();

    const dialog = page.getByRole('dialog', { name: 'Upload & Share Document' });
    await expect(dialog).toContainText(title);
    await dialog.getByLabel('Upload requested document file').setInputFiles(textFile(deliveredName, `Delivered ${STAMP}`));
    await dialog.getByRole('button', { name: 'Upload & Share' }).click();
    await expect(page.getByText(`Document shared with ${USERS.customer.email}`)).toBeVisible({ timeout: 30_000 });

    await expect(requestRow(page)).toContainText('Done', { timeout: 15_000 });
  });

  test('the customer sees it Done and owns the delivered document', async ({ browser }) => {
    const page = await as(browser, 'customer');
    await page.reload();
    await expect(requestRow(page)).toContainText('Done', { timeout: 20_000 });
    await expect(docButton(page, deliveredName)).toBeVisible({ timeout: 20_000 });
    // The requester is made the owner, so they can delete it.
    await expect(page.getByRole('button', { name: `Delete ${deliveredName}` })).toBeVisible();
  });
});
