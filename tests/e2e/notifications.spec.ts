import { test, expect } from '@playwright/test';
import { performLogin } from './helpers';
import {
  COMETCHAT,
  callFunction,
  createdEventIds,
  db,
  deleteEvents,
  expectRecipients,
  linear,
  missingEnv,
  unreadCount,
  sinceNow,
  waitForEvent,
  without,
} from './notifications.helpers';

// Every bell notification type, end to end against the real project: trigger
// the action the way the app does, then check the event row and exactly who
// got a notification (and that the actor didn't). Everything the tests create
// is removed at the end. Runs on Spark-Portal with the test users; uses a
// fixed Linear ticket, "[TEST] Notifications", created on the first run.
//
// Notifications go to every admin, so real admins can briefly see test
// notifications until the cleanup runs.

const SLUG = 'spark-portal';
const TEST_ISSUE_TITLE = '[TEST] Notifications';
const STAMP = `e2e-${Date.now()}`;

const CUSTOMER_EMAIL = process.env.TEST_CUSTOMER_EMAIL!;
const DEVELOPER_EMAIL = process.env.TEST_DEVELOPER_EMAIL!;
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL!;
const PASSWORD = process.env.TEST_PASSWORD!;

type Ctx = {
  since: string;
  customerId: string;
  developerId: string;
  adminId: string;
  admins: string[];
  // customer + everyone assigned + every admin — notifyProject's audience.
  projectAudience: string[];
  issue: { id: string; identifier: string; state: string; teamId: string };
};
const ctx = {} as Ctx;

// Rows to delete at the end.
const created = {
  objectIds: [] as string[],
  decisionIds: [] as string[],
  demoIds: [] as string[],
  designResourceIds: [] as string[],
  documentRequestIds: [] as string[],
  chatIds: [] as string[],
};

test.describe.configure({ mode: 'serial' });

async function userIdByEmail(email: string): Promise<{ id: string; role: string }> {
  const { data, error } = await db().from('users').select('id, role').eq('email', email).single();
  if (error) throw new Error(`${email}: ${error.message}`);
  return data;
}

async function findOrCreateTestIssue(projectIds: string[]): Promise<Ctx['issue']> {
  const found = await linear(
    `query($title: String!, $projects: [ID!]) {
      issues(first: 1, filter: { title: { eq: $title }, project: { id: { in: $projects } } }) {
        nodes { id identifier state { name } team { id } }
      }
    }`,
    { title: TEST_ISSUE_TITLE, projects: projectIds },
  );
  let node = found.issues.nodes[0];
  if (!node) {
    const projects: { id: string }[] = await callFunction('issues/projects', {
      method: 'GET',
      query: `?slug=${SLUG}`,
    });
    const created = await callFunction('issues/create', {
      body: {
        title: TEST_ISSUE_TITLE,
        description: 'Used by tests/e2e/notifications.spec.ts — please leave it open.',
        priority: 'low',
        slug: SLUG,
        projectId: projects[0]?.id,
        requestedBy: ADMIN_EMAIL,
      },
    });
    const byId = await linear(
      `query($id: String!) { issue(id: $id) { id identifier state { name } team { id } } }`,
      { id: created.issue.id },
    );
    node = byId.issue;
  }
  return { id: node.id, identifier: node.identifier, state: node.state.name, teamId: node.team.id };
}

test.beforeAll(async () => {
  test.setTimeout(60_000);
  const missing = missingEnv();
  expect(missing, `missing env (supabase/functions/.env or .env): ${missing.join(', ')}`).toEqual([]);

  ctx.since = sinceNow();
  const [customer, developer, admin] = await Promise.all([
    userIdByEmail(CUSTOMER_EMAIL),
    userIdByEmail(DEVELOPER_EMAIL),
    userIdByEmail(ADMIN_EMAIL),
  ]);
  // notifyProject only finds the initiative's customer by role = 'customer'.
  expect(customer.role, `${CUSTOMER_EMAIL} must have role "customer"`).toBe('customer');
  ctx.customerId = customer.id;
  ctx.developerId = developer.id;
  ctx.adminId = admin.id;

  const { data: customerRow } = await db()
    .from('customers')
    .select('linear_projects')
    .ilike('clientName', SLUG)
    .single();
  const [{ data: assignments }, { data: admins }] = await Promise.all([
    db().from('assignments').select('user_id').eq('customer_id', ctx.customerId),
    db().from('users').select('id').eq('role', 'admin'),
  ]);
  ctx.admins = (admins ?? []).map((a) => a.id);
  ctx.projectAudience = [
    ctx.customerId,
    ...(assignments ?? []).map((a) => a.user_id).filter(Boolean),
    ...ctx.admins,
  ];
  expect(ctx.projectAudience).toContain(ctx.developerId);

  ctx.issue = await findOrCreateTestIssue(customerRow!.linear_projects ?? []);
});

test.afterAll(async () => {
  test.setTimeout(60_000);
  const sb = db();
  if (created.decisionIds.length) await sb.from('decisions').delete().in('id', created.decisionIds);
  if (created.demoIds.length) await sb.from('demo_videos').delete().in('id', created.demoIds);
  if (created.designResourceIds.length) await sb.from('design_resources').delete().in('id', created.designResourceIds);
  if (created.documentRequestIds.length) await sb.from('document_requests').delete().in('id', created.documentRequestIds);
  if (created.chatIds.length) await sb.from('chats').delete().in('id', created.chatIds);
  if (ctx.since) {
    await deleteEvents({ since: ctx.since, issueId: ctx.issue?.id, objectIds: created.objectIds });
  }
});

const issueContext = () => ({
  slug: SLUG,
  issueCode: ctx.issue.identifier,
  issueType: 'feature',
});

// ── Tickets ────────────────────────────────────────────────────────────────

test.describe('ticket notifications', () => {
  test('decision_requested — customer asks a question', async () => {
    const since = sinceNow();
    const question = `Question ${STAMP}`;
    const decision = await callFunction('issues', {
      body: { issueId: ctx.issue.id, question, ownerEmail: CUSTOMER_EMAIL, ...issueContext(), type: 'question' },
    });
    created.decisionIds.push(decision.id);
    created.objectIds.push(decision.id);

    const event = await waitForEvent({ action: 'decision_requested', objectId: decision.id, since });
    expect(event).toMatchObject({
      object_type: 'issue_decision',
      actor_email: CUSTOMER_EMAIL,
      issue_id: ctx.issue.id,
      issue_code: ctx.issue.identifier,
      preview: question,
      link: `/${SLUG}/build`,
    });
    await expectRecipients(event.id, without(ctx.projectAudience, ctx.customerId));
  });

  test('decision_answered — developer answers it', async () => {
    const decisionId = created.decisionIds.at(-1)!;
    const since = sinceNow();
    await callFunction('issues/decision', {
      method: 'PATCH',
      body: { decisionId, decision: `Answer ${STAMP}`, decisionEmail: DEVELOPER_EMAIL, ...issueContext() },
    });

    const event = await waitForEvent({ action: 'decision_answered', objectId: decisionId, since });
    expect(event).toMatchObject({ actor_email: DEVELOPER_EMAIL, preview: `Answer ${STAMP}` });
    await expectRecipients(event.id, without(ctx.projectAudience, ctx.developerId));
    // Same ticket and type as the question: still one unread per person.
    expect(await unreadCount(ctx.customerId, 'issue_decision', { issueId: ctx.issue.id })).toBe(1);
  });

  test('requirement_update_added — developer posts a requirement update', async () => {
    const since = sinceNow();
    const text = `Requirement update ${STAMP}`;
    const decision = await callFunction('issues', {
      body: {
        issueId: ctx.issue.id,
        question: text,
        ownerEmail: DEVELOPER_EMAIL,
        ...issueContext(),
        type: 'requirement_update',
      },
    });
    created.decisionIds.push(decision.id);
    created.objectIds.push(decision.id);

    const event = await waitForEvent({ action: 'requirement_update_added', objectId: decision.id, since });
    expect(event.preview).toBe(text);
    await expectRecipients(event.id, without(ctx.projectAudience, ctx.developerId));
  });

  test('status_changed — developer moves the ticket (and back)', async () => {
    test.setTimeout(90_000);
    const original = ctx.issue.state;
    const target = original === 'Planning' ? 'Backlog' : 'Planning';
    const since = sinceNow();
    try {
      await callFunction('issues', {
        method: 'PATCH',
        body: { issueId: ctx.issue.id, stateName: target, actorEmail: DEVELOPER_EMAIL, ...issueContext() },
      });
      const event = await waitForEvent({ action: 'status_changed', objectId: ctx.issue.id, since });
      expect(event).toMatchObject({
        object_type: 'issue_status',
        preview: `from ${original} to ${target}`,
        link: `/${SLUG}/build`,
      });
      await expectRecipients(event.id, without(ctx.projectAudience, ctx.developerId));
    } finally {
      // Put it back (no slug → no second notification).
      await callFunction('issues', { method: 'PATCH', body: { issueId: ctx.issue.id, stateName: original } });
    }
  });

  test('no status_changed when the status stays the same', async () => {
    const since = sinceNow();
    await callFunction('issues', {
      method: 'PATCH',
      body: { issueId: ctx.issue.id, stateName: ctx.issue.state, actorEmail: DEVELOPER_EMAIL, ...issueContext() },
    });
    await new Promise((r) => setTimeout(r, 4000));
    const { data } = await db()
      .from('events')
      .select('id')
      .eq('action', 'status_changed')
      .eq('object_id', ctx.issue.id)
      .gte('created_at', since);
    expect((data ?? []).filter((e) => !createdEventIds.has(e.id))).toEqual([]);
  });
});

// ── Demos ─────────────────────────────────────────────────────────────────

test.describe('demo notifications', () => {
  let demoId = '';
  let commentId = '';

  test('demo_uploaded — developer adds a demo', async () => {
    const since = sinceNow();
    const title = `Demo ${STAMP}`;
    const demo = await callFunction('demo-videos', {
      body: {
        issue_id: ctx.issue.id,
        email: DEVELOPER_EMAIL,
        embed_url: 'https://www.loom.com/share/e2e-notifications-test',
        title,
        slug: SLUG,
        issue_code: ctx.issue.identifier,
        issue_type: 'feature',
      },
    });
    demoId = demo.id;
    created.demoIds.push(demoId);
    created.objectIds.push(demoId);

    const event = await waitForEvent({ action: 'demo_uploaded', objectId: demoId, since });
    expect(event).toMatchObject({ object_type: 'demo', preview: title, issue_id: ctx.issue.id });
    await expectRecipients(event.id, without(ctx.projectAudience, ctx.developerId));
  });

  test('demo_comment_added — customer feedback reaches the uploader and admins', async () => {
    const since = sinceNow();
    const comment = await callFunction('demo-videos', {
      query: '?type=comments',
      body: {
        demo_video_id: demoId,
        email: CUSTOMER_EMAIL,
        body: `Feedback ${STAMP}`,
        slug: SLUG,
        issue_code: ctx.issue.identifier,
        issue_type: 'feature',
      },
    });
    commentId = comment.id;

    const event = await waitForEvent({ action: 'demo_comment_added', objectId: demoId, since });
    expect(event).toMatchObject({ object_type: 'demo_comment', preview: `Feedback ${STAMP}` });
    await expectRecipients(event.id, [ctx.developerId, ...ctx.admins]);
  });

  test('demo_comment_edited — editing re-notifies without a second unread', async () => {
    const since = sinceNow();
    await callFunction('demo-videos', {
      method: 'PATCH',
      query: '?type=comments',
      body: {
        id: commentId,
        email: CUSTOMER_EMAIL,
        body: `Edited feedback ${STAMP}`,
        slug: SLUG,
        issue_code: ctx.issue.identifier,
        issue_type: 'feature',
      },
    });

    const event = await waitForEvent({ action: 'demo_comment_edited', objectId: demoId, since });
    expect(event.preview).toBe(`Edited feedback ${STAMP}`);
    await expectRecipients(event.id, [ctx.developerId, ...ctx.admins]);
    expect(await unreadCount(ctx.developerId, 'demo_comment', { issueId: ctx.issue.id })).toBe(1);
  });

  test('only the author can edit their feedback', async () => {
    await expect(
      callFunction('demo-videos', {
        method: 'PATCH',
        query: '?type=comments',
        body: { id: commentId, email: DEVELOPER_EMAIL, body: 'not mine', slug: SLUG },
      }),
    ).rejects.toThrow(/403/);
  });
});

// ── Design resources ──────────────────────────────────────────────────────

test('design_resource_added — developer adds a Figma link', async () => {
  const since = sinceNow();
  const title = `Design ${STAMP}`;
  const resource = await callFunction('design-resources', {
    body: {
      issue_id: ctx.issue.id,
      project_slug: SLUG,
      resource_type: 'figma',
      url: 'https://www.figma.com/design/e2eNotifications/Test',
      title,
      email: DEVELOPER_EMAIL,
      issue_code: ctx.issue.identifier,
      issue_type: 'feature',
    },
  });
  const id = resource.id ?? resource.data?.id;
  created.designResourceIds.push(id);
  created.objectIds.push(id);

  const event = await waitForEvent({ action: 'design_resource_added', objectId: id, since });
  expect(event).toMatchObject({ object_type: 'design_resource', preview: title });
  await expectRecipients(event.id, without(ctx.projectAudience, ctx.developerId));
});

// ── Document requests ─────────────────────────────────────────────────────

test.describe('document request notifications', () => {
  let requestId = '';
  const title = `Document ${STAMP}`;
  // Claimed / unassigned / delivered go to the requester + every admin.
  const requesterAndAdmins = () => [ctx.customerId, ...ctx.admins];

  test('document_request_created — customer asks for a document', async () => {
    const since = sinceNow();
    const request = await callFunction('document-requests', {
      body: { customerSlug: SLUG, requestedBy: CUSTOMER_EMAIL, title },
    });
    requestId = String(request.id);
    created.documentRequestIds.push(requestId);
    created.objectIds.push(requestId);

    const event = await waitForEvent({ action: 'document_request_created', objectId: requestId, since });
    expect(event).toMatchObject({
      object_type: 'document_request',
      object_title: title,
      link: `/${SLUG}/documents`,
    });
    await expectRecipients(event.id, without(ctx.projectAudience, ctx.customerId));
  });

  test('document_request_claimed — developer takes it', async () => {
    const since = sinceNow();
    await callFunction('document-requests', {
      method: 'PATCH',
      body: { action: 'claim', id: requestId, claimedBy: DEVELOPER_EMAIL },
    });
    const event = await waitForEvent({ action: 'document_request_claimed', objectId: requestId, since });
    await expectRecipients(event.id, requesterAndAdmins());
  });

  test('document_request_released — admin unassigns the developer', async () => {
    const since = sinceNow();
    await callFunction('document-requests', {
      method: 'PATCH',
      body: { action: 'release', id: requestId, releasedBy: ADMIN_EMAIL },
    });
    const event = await waitForEvent({ action: 'document_request_released', objectId: requestId, since });
    // The developer who lost it hears about it too; the acting admin doesn't.
    await expectRecipients(event.id, without([...requesterAndAdmins(), ctx.developerId], ctx.adminId));
  });

  test('document_request_completed — developer delivers it', async () => {
    await callFunction('document-requests', {
      method: 'PATCH',
      body: { action: 'claim', id: requestId, claimedBy: DEVELOPER_EMAIL },
    });
    const since = sinceNow();
    await callFunction('document-requests', {
      method: 'PATCH',
      body: { action: 'complete', id: requestId, completedBy: DEVELOPER_EMAIL },
    });
    const event = await waitForEvent({ action: 'document_request_completed', objectId: requestId, since });
    await expectRecipients(event.id, requesterAndAdmins());
  });
});

// ── Chat: Supabase Realtime (notify_chat_message trigger) ─────────────────

test.describe('chat notifications — Supabase Realtime', () => {
  let chatId = '';
  const chatTitle = `Chat ${STAMP}`;

  test.beforeAll(async () => {
    const { data: chat, error } = await db()
      .from('chats')
      .insert({ project_slug: SLUG, title: chatTitle, type: 'group', created_by: ctx.customerId })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    chatId = chat.id;
    created.chatIds.push(chatId);
    created.objectIds.push(chatId);
    const { error: pErr } = await db()
      .from('chat_participants')
      .insert([
        { chat_id: chatId, user_id: ctx.customerId },
        { chat_id: chatId, user_id: ctx.developerId },
      ]);
    if (pErr) throw new Error(pErr.message);
  });

  async function send(userId: string, body: string, metadata?: object) {
    const { error } = await db()
      .from('messages')
      .insert({ chat_id: chatId, user_id: userId, body, ...(metadata ? { metadata } : {}) });
    if (error) throw new Error(error.message);
  }

  test('a message notifies the other participants and every admin', async () => {
    const since = sinceNow();
    await send(ctx.customerId, `Hello ${STAMP}`);

    const event = await waitForEvent({ action: 'chat_message', objectId: chatId, since });
    expect(event).toMatchObject({
      object_type: 'chat',
      object_title: chatTitle,
      actor_email: CUSTOMER_EMAIL,
      preview: `Hello ${STAMP}`,
      link: '/chat',
    });
    await expectRecipients(event.id, [ctx.developerId, ...ctx.admins]);
  });

  test('more messages keep one unread notification per chat', async () => {
    const since = sinceNow();
    await send(ctx.customerId, `Second ${STAMP}`);
    const event = await waitForEvent({ action: 'chat_message', objectId: chatId, since });
    expect(event.preview).toBe(`Second ${STAMP}`);
    await expectRecipients(event.id, [ctx.developerId, ...ctx.admins]);
    expect(await unreadCount(ctx.developerId, 'chat', { objectId: chatId })).toBe(1);
  });

  test('an attachment-only message previews as "Sent an attachment"', async () => {
    const since = sinceNow();
    await send(ctx.developerId, '', {
      attachments: [{ path: `${chatId}/e2e.png`, name: 'e2e.png', mimeType: 'image/png', size: 1 }],
    });
    const event = await waitForEvent({ action: 'chat_message', objectId: chatId, since });
    expect(event.preview).toBe('Sent an attachment');
    await expectRecipients(event.id, [ctx.customerId, ...ctx.admins]);
  });

  test('the bell shows it and opens the chat', async ({ page }) => {
    test.setTimeout(90_000);
    await send(ctx.customerId, `Bell ${STAMP}`);
    await waitForEvent({ action: 'chat_message', objectId: chatId, since: ctx.since });

    await performLogin(page, DEVELOPER_EMAIL, PASSWORD, '/developer');
    await page.getByRole('button', { name: /^Notifications, \d+ unread$/ }).first().click();
    const item = page.getByRole('button', { name: new RegExp(`sent a message in ${chatTitle}`) });
    await expect(item).toBeVisible({ timeout: 15_000 });
    await item.click();
    // Realtime events link to the generic chat page, resolved per role (the
    // old /dev/chat redirects into the initiative).
    await expect(page).toHaveURL(new RegExp(`/chat\\?chatId=${chatId}`), { timeout: 15_000 });
  });
});

// ── Chat: CometChat (webhook → supabase/functions/cometchat) ──────────────

test.describe('chat notifications — CometChat', () => {
  // The ticket's chat group, same guid the app uses (getOrCreateIssueGroup).
  const guid = () => `issue_${ctx.issue.id.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;

  test('webhook payload → members of the ticket chat and admins, linked to the initiative', async () => {
    test.setTimeout(60_000);
    created.objectIds.push(guid());
    // What CometChat posts on "after message" (v3 shape). Tests our function
    // without depending on CometChat itself.
    const send = (text: string) =>
      callFunction('cometchat', {
        body: {
          trigger: 'after_message',
          data: {
            message: {
              type: 'text',
              receiverType: 'group',
              receiver: guid(),
              sender: ctx.developerId,
              data: { text },
            },
          },
        },
      }).catch(() => undefined); // the AI reply afterwards may fail; the notification doesn't depend on it

    const since = sinceNow();
    await send(`Webhook ${STAMP}`);
    const event = await waitForEvent({ action: 'chat_message', objectId: guid(), since });
    expect(event).toMatchObject({
      object_type: 'chat',
      actor_email: DEVELOPER_EMAIL,
      preview: `Webhook ${STAMP}`,
      object_title: TEST_ISSUE_TITLE,
      link: `/${SLUG}/chat`,
    });
    await expectRecipients(event.id, without(ctx.projectAudience, ctx.developerId));

    // Grouping: a second message keeps one unread per person.
    const since2 = sinceNow();
    await send(`Webhook again ${STAMP}`);
    const second = await waitForEvent({ action: 'chat_message', objectId: guid(), since: since2 });
    await expectRecipients(second.id, without(ctx.projectAudience, ctx.developerId));
    expect(await unreadCount(ctx.customerId, 'chat', { objectId: guid() })).toBe(1);
  });

  test('real message through CometChat reaches the webhook', async () => {
    test.skip(!COMETCHAT.appId || !COMETCHAT.apiKey, 'CometChat keys not in supabase/functions/.env');
    test.setTimeout(120_000);
    const api = `https://${COMETCHAT.appId}.api-${COMETCHAT.region}.cometchat.io/v3`;
    const headers = { appId: COMETCHAT.appId, apiKey: COMETCHAT.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' };
    const cc = async (method: string, path: string, body?: unknown, extra: Record<string, string> = {}) => {
      const res = await fetch(`${api}${path}`, {
        method,
        headers: { ...headers, ...extra },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { ok: res.ok, status: res.status, json: await res.json().catch(() => null) };
    };

    // The customer must exist in CometChat and be in the ticket's group.
    const user = await cc('GET', `/users/${ctx.customerId}`);
    test.skip(
      user.json?.error?.code === 'AUTH_ERR_NO_ACCESS',
      'COMETCHAT_API_KEY has no REST API access — use a key with full access (CometChat dashboard → API & Auth Keys)',
    );
    if (!user.ok) {
      await cc('POST', '/users', { uid: ctx.customerId, name: CUSTOMER_EMAIL });
    }
    if (!(await cc('GET', `/groups/${guid()}`)).ok) {
      const made = await cc('POST', '/groups', { guid: guid(), name: TEST_ISSUE_TITLE, type: 'private' });
      expect(made.ok, `create group: ${JSON.stringify(made.json)}`).toBe(true);
    }
    await cc('POST', `/groups/${guid()}/members`, { participants: [ctx.customerId] });

    const since = sinceNow();
    const sent = await cc(
      'POST',
      '/messages',
      { receiver: guid(), receiverType: 'group', category: 'message', type: 'text', data: { text: `CometChat ${STAMP}` } },
      { onBehalfOf: ctx.customerId },
    );
    expect(sent.ok, `send message: ${JSON.stringify(sent.json)}`).toBe(true);

    // CometChat → webhook → notification can take a while.
    const event = await waitForEvent({ action: 'chat_message', objectId: guid(), since }, 60_000);
    expect(event).toMatchObject({ actor_email: CUSTOMER_EMAIL, preview: `CometChat ${STAMP}`, link: `/${SLUG}/chat` });
    await expectRecipients(event.id, without(ctx.projectAudience, ctx.customerId));
  });
});
