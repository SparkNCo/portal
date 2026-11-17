import { Page, expect } from '@playwright/test';

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

// ── Where each account must land after logging in ──────────────────────────

type Assignment = { clientName?: string | null; linear_slug?: string | null };
export type LoginProfile = {
  role?: string | null;
  email?: string;
  clientName?: string | null;
  assignment_id?: Assignment[] | null;
};

// Logs in and returns the portal profile the login page loaded
// (GET /functions/v1/users?email=), so the test can work out on its own
// where this account has to land.
export async function loginCapturingProfile(page: Page, email: string, password: string): Promise<LoginProfile> {
  const profileResponse = page.waitForResponse(
    (res) => res.url().includes('/functions/v1/users?email=') && res.request().method() === 'GET',
    { timeout: 30_000 },
  );
  await fillLoginForm(page, email, password);
  const res = await profileResponse;
  expect(res.ok(), `profile request failed with ${res.status()}`).toBe(true);
  const profile = (await res.json()) as LoginProfile | null;
  expect(profile, `${email} has no portal.users row`).not.toBeNull();
  return profile!;
}

export function developerClientNames(profile: LoginProfile): string[] {
  const names = (profile.assignment_id ?? []).map((a) => a?.clientName).filter((n): n is string => !!n);
  return [...new Set(names)];
}

// The home page each role must land on, from the account's own data. Written
// out here on purpose, not imported from lib/: the e2e tests check the app
// against an independent statement of the rule (docs/LOGIN_FLOWS.md):
//   admin        /admin/users
//   customer     /{clientName}/dashboard
//   stakeholder  /{first assignment's clientName}/dashboard
//   developer    /{"Working on" pick, if still theirs, else first assignment}/developer
//                (/dev/developer with no assignments)
// Slugs are lowercased. Returns the decoded path.
export function expectedHomePath(profile: LoginProfile, workingOn?: string | null): string {
  const slug = (name: string) => `/${name.toLowerCase()}`;
  switch (profile.role) {
    case 'admin':
      return '/admin/users';
    case 'customer':
      if (!profile.clientName) {
        throw new Error('test customer has no clientName: fix the test account');
      }
      return `${slug(profile.clientName)}/dashboard`;
    case 'stakeholder': {
      const first = profile.assignment_id?.[0];
      const name = first?.clientName ?? first?.linear_slug ?? profile.clientName;
      if (!name) {
        throw new Error('test stakeholder has no client assigned: fix the test account');
      }
      return `${slug(name)}/dashboard`;
    }
    case 'developer': {
      const names = developerClientNames(profile);
      const picked = workingOn ? names.find((n) => n.toLowerCase() === workingOn.toLowerCase()) : undefined;
      const project = picked ?? names[0];
      return project ? `${slug(project)}/developer` : '/dev/developer';
    }
    default:
      throw new Error(`unexpected role "${profile.role}" for a test account`);
  }
}

export function currentPath(page: Page): string {
  return decodeURIComponent(new URL(page.url()).pathname);
}

// Lands on exactly `path` and stays there: the page's own access check
// agrees (no bounce elsewhere, no "no access" toast).
export async function expectToLandOn(page: Page, path: string) {
  await expect(page).toHaveURL((url) => decodeURIComponent(url.pathname) === path, { timeout: 30_000 });
  await page.waitForSelector('h1', { timeout: 20_000 });
  await expect(page.getByText("You don't have access to that initiative")).toHaveCount(0);
  await expect(page.getByText("That page isn't available for your role")).toHaveCount(0);
  expect(currentPath(page)).toBe(path);
}

// Logs in as the test account in `envEmail` from the login page, checks it
// has the expected role and lands on its own home page. Returns the profile.
export async function loginAndExpectHome(
  page: Page,
  envEmail: string,
  role: 'admin' | 'customer' | 'stakeholder' | 'developer',
): Promise<LoginProfile> {
  const email = process.env[envEmail]!;
  const password = process.env.TEST_PASSWORD!;
  const profile = await loginCapturingProfile(page, email, password);
  expect(profile.role, `${envEmail} should be a ${role} account`).toBe(role);
  await expectToLandOn(page, expectedHomePath(profile));
  return profile;
}
