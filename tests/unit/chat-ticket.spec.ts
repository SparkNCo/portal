import { test, expect } from '@playwright/test';
import { issueIdFromGroupGuid } from '../../lib/chat-ticket';

test.describe('ticket of a CometChat group', () => {
  test('a Linear ticket group gives back the ticket id', () => {
    expect(issueIdFromGroupGuid('issue_0b9c1f4e_2a3d_4c5e_8f9a_1b2c3d4e5f60')).toBe('0b9c1f4e-2a3d-4c5e-8f9a-1b2c3d4e5f60');
  });

  test('not a ticket group, or not reversible: none', () => {
    expect(issueIdFromGroupGuid('support_acme_123')).toBeNull();
    expect(issueIdFromGroupGuid('issue_jira_0b9c1f4e_2a3d_4c5e_8f9a_1b2c3d4e5f60_spa_12')).toBeNull();
    expect(issueIdFromGroupGuid(undefined)).toBeNull();
  });
});
