import { Page } from '@playwright/test';

export async function fillLoginForm(page: Page, email: string, password: string) {
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
}

export async function performLogin(
  page: Page,
  email: string,
  password: string,
  redirectPath: string,
) {
  await page.goto('/');
  await fillLoginForm(page, email, password);
  await page.waitForURL(`**${redirectPath}`, { timeout: 15_000 });
  await page.waitForSelector('h1', { timeout: 15_000 });
}
