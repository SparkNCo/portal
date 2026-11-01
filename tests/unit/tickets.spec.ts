import { test, expect } from '@playwright/test';
import {
  describeJiraResponse,
  normalizeJiraBaseUrl,
  normalizeJiraProjectKey,
  parseJiraInput,
  ticketSystemOf,
} from '../../supabase/functions/lib/tickets/ticketSystem';
import { ticketSettingsBody, ticketSettingsComplete, ticketSettingsFrom } from '../../lib/ticket-systems';

// Per-customer ticket system (Linear / Jira) — no network, no browser.

test.describe('ticket system of a customer', () => {
  test('missing or unknown means Linear, so older customers are unaffected', () => {
    expect(ticketSystemOf(null)).toBe('linear');
    expect(ticketSystemOf({ chat: 'cometchat', vector: 'upstash' })).toBe('linear');
    expect(ticketSystemOf({ tickets: 'ado' })).toBe('linear');
    expect(ticketSystemOf({ tickets: 'jira' })).toBe('jira');
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
