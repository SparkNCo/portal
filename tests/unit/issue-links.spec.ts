import { test, expect } from '@playwright/test';
import { isTicketCode, issueCodeOf, issueShareUrl, matchesIssueRef } from '../../hooks/use-issue-deep-link';

// Ticket links (SPA-500 / SPA-600): /{slug}/monitor?ticket=SPA-123&tab=…

test.describe('ticket links', () => {
  test('the copied link is the initiative\'s Monitor with the ticket number and tab', () => {
    expect(issueShareUrl('https://app.example.com', 'Acme', 'spa-123', 'decisions')).toBe(
      'https://app.example.com/acme/monitor?ticket=SPA-123&tab=decisions',
    );
    // The default tab is left out.
    expect(issueShareUrl('', 'acme', 'SPA-7', 'description')).toBe('/acme/monitor?ticket=SPA-7');
  });

  test('a ticket number comes from the Jira key or the Linear branch name', () => {
    expect(issueCodeOf({ identifier: 'proj-45' })).toBe('PROJ-45');
    expect(issueCodeOf({ branchName: 'santiago/spa-123-login-with-sso' })).toBe('SPA-123');
  });

  test('a link matches its ticket by number or by id', () => {
    const issue = { id: '6f1c2a3b-1111-2222-3333-444455556666', branchName: 'dev/spa-123-fix' };
    expect(matchesIssueRef(issue, 'SPA-123')).toBe(true);
    expect(matchesIssueRef(issue, 'spa-123')).toBe(true);
    expect(matchesIssueRef(issue, issue.id)).toBe(true);
    expect(matchesIssueRef(issue, 'SPA-12')).toBe(false);
    expect(matchesIssueRef(issue, null)).toBe(false);
  });

  test('ticket numbers are told apart from ids', () => {
    expect(isTicketCode('SPA-123')).toBe(true);
    expect(isTicketCode('6f1c2a3b-1111-2222-3333-444455556666')).toBe(false);
    expect(isTicketCode('jira:6f1c2a3b-1111-2222-3333-444455556666:SPA-12')).toBe(false);
  });
});
