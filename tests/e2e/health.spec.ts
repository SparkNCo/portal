import { test, expect } from '@playwright/test';

test.describe('Health Check', () => {
  test('should return 200 OK', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toBe('ok');
  });
});
