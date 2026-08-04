import { test, expect } from '@playwright/test';

// These tests exercise only the client-side detection of an expired invite
// link (`error_code=otp_expired` on the redirect URL) — no real Supabase
// invite/session is created or required, so no test-account credentials are
// needed here.

test.describe('Set password — expired invite link', () => {

  test('shows the expired-link modal and stops the verifying state', async ({ page }) => {
    await page.goto(
      '/set-password?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );

    // Modal appears with the expired-link copy
    await expect(page.getByText('Invite link expired')).toBeVisible();
    await expect(
      page.getByText(
        'This invite link has expired. Please contact your administrator for a new login link.',
      ).first(),
    ).toBeVisible();

    // The page must not be left suggesting verification is still happening
    await expect(page.getByText('Verifying invite link...')).not.toBeVisible();
  });

  test('dismissing the modal leaves the page in a stable, non-loading state', async ({ page }) => {
    await page.goto(
      '/set-password?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );

    await expect(page.getByText('Invite link expired')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    // Modal is gone, but the page still doesn't revert to the loading state —
    // the expired-link message stays visible behind it.
    await expect(page.getByText('Invite link expired')).not.toBeVisible();
    await expect(page.getByText('Verifying invite link...')).not.toBeVisible();
    await expect(
      page.getByText(
        'This invite link has expired. Please contact your administrator for a new login link.',
      ),
    ).toBeVisible();
  });

  test('a non-expired error code does not show the expired-link modal', async ({ page }) => {
    await page.goto('/set-password?error=access_denied&error_code=otp_disabled');

    await expect(page.getByText('Invite link expired')).not.toBeVisible();
  });

  test('no error params — page still shows the normal verifying state', async ({ page }) => {
    await page.goto('/set-password');

    await expect(page.getByText('Invite link expired')).not.toBeVisible();
    await expect(page.getByText('Verifying invite link...')).toBeVisible();
  });

});
