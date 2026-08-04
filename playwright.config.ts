import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.test') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Stage 1: login — must pass before role tests run
  // Stage 2: role tests run with up to 2 workers
  projects: [
    {
      name: 'login',
      testMatch: ['**/login.spec.ts', '**/example.spec.ts', '**/set-password.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'admin',
      testMatch: '**/admin.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['login'],
    },
    {
      name: 'developer',
      testMatch: '**/developer.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['login'],
    },
    {
      name: 'stakeholder',
      testMatch: '**/stakeholder.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['login'],
    },
  ],

  /* Start the dev server before running tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
