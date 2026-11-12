import { test, expect } from '@playwright/test';
import {
  describeJiraResponse,
  normalizeJiraBaseUrl,
  normalizeJiraProjectKey,
  parseJiraInput,
  ticketSystemOf,
} from '../../supabase/functions/lib/tickets/ticketSystem';
import { ticketSettingsBody, ticketSettingsComplete, ticketSettingsFrom } from '../../lib/ticket-systems';
import { jiraId, parseTicketId } from '../../supabase/functions/lib/tickets/ids';
import { isProjectRequired, pickRememberedProject } from '../../lib/issues-api';

// Per-customer ticket system (Linear / Jira) — no network, no browser.

test.describe('ticket system of a customer', () => {
  test('missing or unknown means Linear, so older customers are unaffected', () => {
    expect(ticketSystemOf(null)).toBe('linear');
    expect(ticketSystemOf({ chat: 'cometchat' })).toBe('linear');
    expect(ticketSystemOf({ tickets: 'ado' })).toBe('linear');
    expect(ticketSystemOf({ tickets: 'jira' })).toBe('jira');
  });
});

test.describe('ticket ids', () => {
  const customerId = '6f1c2b3a-1111-4222-8333-944455556666';

  test('Linear ids pass through untouched, whatever they look like', () => {
    expect(parseTicketId('2b7c0a1e-3f4d-4e5f-8a9b-0c1d2e3f4a5b')).toEqual({ system: 'linear', nativeId: '2b7c0a1e-3f4d-4e5f-8a9b-0c1d2e3f4a5b' });
    expect(parseTicketId('SPA-487')).toEqual({ system: 'linear', nativeId: 'SPA-487' });
  });

  test('Jira ids carry their customer, and round-trip', () => {
    const id = jiraId(customerId, 'SPA-12');
    expect(id).toBe(`jira:${customerId}:SPA-12`);
    expect(parseTicketId(id)).toEqual({ system: 'jira', customerId, nativeId: 'SPA-12' });
    expect(parseTicketId(jiraId(customerId, 42))).toEqual({ system: 'jira', customerId, nativeId: '42' });
  });

  test('a malformed jira: id is not treated as Jira', () => {
    expect(parseTicketId('jira:not-a-uuid:SPA-1').system).toBe('linear');
  });
});

test.describe('project on a new bug', () => {
  const customerId = '6f1c2b3a-1111-4222-8333-944455556666';

  test('required on Linear, where a ticket without a project never shows up in the portal', () => {
    expect(isProjectRequired([{ id: '2b7c0a1e-3f4d-4e5f-8a9b-0c1d2e3f4a5b' }])).toBe(true);
    expect(isProjectRequired([])).toBe(true);
  });

  test('optional on Jira, where projects are epics and every ticket is listed', () => {
    expect(isProjectRequired([{ id: jiraId(customerId, 'SPA-3') }])).toBe(false);
  });
});

test.describe('Jira input', () => {
  test('the URL keeps only the site, whatever page was pasted', () => {
    expect(normalizeJiraBaseUrl('acme.atlassian.net')).toBe('https://acme.atlassian.net');
    expect(normalizeJiraBaseUrl(' https://ACME.atlassian.net/jira/software/projects/ACME/boards/1 ')).toBe('https://acme.atlassian.net');
    expect(normalizeJiraBaseUrl('http://acme.atlassian.net')).toBeNull();
    expect(normalizeJiraBaseUrl('not a url')).toBeNull();
    expect(normalizeJiraBaseUrl('')).toBeNull();
  });

  test('project keys are upper-cased and must look like a Jira key', () => {
    expect(normalizeJiraProjectKey(' acme ')).toBe('ACME');
    expect(normalizeJiraProjectKey('WEB2')).toBe('WEB2');
    expect(normalizeJiraProjectKey('ACME-12')).toBeNull();
    expect(normalizeJiraProjectKey('2WEB')).toBeNull();
    expect(normalizeJiraProjectKey('')).toBeNull();
  });

  test('parseJiraInput checks every field and says which one is wrong', () => {
    const ok = parseJiraInput({ base_url: 'acme.atlassian.net', email: 'bot@acme.com', api_token: ' tok ' }, 'acme');
    expect(ok).toEqual({ settings: { base_url: 'https://acme.atlassian.net', email: 'bot@acme.com' }, projectKey: 'ACME', token: 'tok' });

    expect(parseJiraInput({ base_url: 'acme.atlassian.net', email: 'bot@acme.com' }, 'ACME')).toMatchObject({ token: null });
    expect(parseJiraInput({ email: 'bot@acme.com' }, 'ACME')).toMatchObject({ error: expect.stringContaining('Jira URL') });
    expect(parseJiraInput({ base_url: 'acme.atlassian.net', email: 'nope' }, 'ACME')).toMatchObject({ error: expect.stringContaining('email') });
    expect(parseJiraInput({ base_url: 'acme.atlassian.net', email: 'bot@acme.com' }, 'ACME-1')).toMatchObject({
      error: expect.stringContaining('project key'),
    });
  });

  test('Jira errors are told apart', () => {
    expect(describeJiraResponse(401, 'account')).toContain('email and API token');
    expect(describeJiraResponse(404, 'project', 'ACME')).toContain('Project "ACME"');
    expect(describeJiraResponse(404, 'account')).toContain("doesn't look like a Jira site");
    expect(describeJiraResponse(500, 'account')).toContain('(500)');
  });
});

test.describe('Add/Edit Customer form', () => {
  test('starts from the stored systems, never with a token', () => {
    const settings = ticketSettingsFrom({ tickets: 'jira', jira: { base_url: 'https://acme.atlassian.net', email: 'bot@acme.com' } }, 'ACME');
    expect(settings).toEqual({
      system: 'jira',
      projectId: 'ACME',
      jiraBaseUrl: 'https://acme.atlassian.net',
      jiraEmail: 'bot@acme.com',
      jiraApiToken: '',
    });
    expect(ticketSettingsFrom(null, 'acme').system).toBe('linear');
  });

  test('Jira needs a token unless one is already stored', () => {
    const jira = ticketSettingsFrom({ tickets: 'jira', jira: { base_url: 'https://acme.atlassian.net', email: 'bot@acme.com' } }, 'ACME');
    expect(ticketSettingsComplete(jira)).toBe(false);
    expect(ticketSettingsComplete(jira, true)).toBe(true);
    expect(ticketSettingsComplete({ ...jira, jiraApiToken: 'tok' })).toBe(true);
    expect(ticketSettingsComplete(ticketSettingsFrom(null, 'acme'))).toBe(true);
    expect(ticketSettingsComplete(ticketSettingsFrom(null, ''))).toBe(false);
  });

  test('the body sends Jira details only for Jira, and a blank token is left out', () => {
    expect(ticketSettingsBody(ticketSettingsFrom(null, ' acme '))).toEqual({ ticket_system: 'linear', linear_slug: 'acme' });

    const jira = ticketSettingsFrom({ tickets: 'jira', jira: { base_url: 'https://acme.atlassian.net', email: 'bot@acme.com' } }, 'ACME');
    expect(ticketSettingsBody(jira)).toEqual({
      ticket_system: 'jira',
      linear_slug: 'ACME',
      jira: { base_url: 'https://acme.atlassian.net', email: 'bot@acme.com' },
    });
    expect(ticketSettingsBody({ ...jira, jiraApiToken: 'tok' }).jira).toMatchObject({ api_token: 'tok' });
  });
});

test.describe('last project for the next ticket', () => {
  const projects = [{ id: 'p-1' }, { id: 'p-2' }];
  const now = 1_000_000_000_000;
  const saved = (projectId: unknown, savedAt: unknown) => JSON.stringify({ projectId, savedAt });

  test('remembered for a few hours, while it is still one of the customer’s projects', () => {
    expect(pickRememberedProject(saved('p-2', now - 60_000), projects, now)).toBe('p-2');
    expect(pickRememberedProject(saved('p-2', now - 9 * 60 * 60 * 1000), projects, now)).toBeNull();
    expect(pickRememberedProject(saved('p-other', now), projects, now)).toBeNull();
  });

  test('anything odd in storage is ignored', () => {
    expect(pickRememberedProject(null, projects, now)).toBeNull();
    expect(pickRememberedProject('not json', projects, now)).toBeNull();
    expect(pickRememberedProject(saved(42, now), projects, now)).toBeNull();
    expect(pickRememberedProject(saved('p-1', now + 60_000), projects, now)).toBeNull();
  });
});
