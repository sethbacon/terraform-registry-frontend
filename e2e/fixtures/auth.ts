import { test as base, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const AUTH_DIR = path.join(__dirname, '../.auth');

/**
 * Logs in via the "Dev Login (Admin)" button on the login page.
 * This requires the backend to be running with DEV_MODE=true.
 */
async function devLogin(page: Page): Promise<void> {
  await page.goto('/login');

  const devLoginBtn = page.getByRole('button', { name: 'Dev Login (Admin)' });

  // Verify the dev login button is present; if not, the backend is not in dev mode.
  await expect(devLoginBtn).toBeVisible({
    timeout: 10_000,
  });

  await devLoginBtn.click();

  // After dev login the app redirects to / (dashboard or modules page).
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), {
    timeout: 10_000,
  });
}

type WorkerFixtures = {
  workerStorageState: string;
};

/**
 * Custom test with two auth-related fixtures:
 *
 * workerStorageState (worker-scoped):
 *   Runs once per Playwright worker. Launches a temporary browser context,
 *   performs the dev-login round-trip, and saves the resulting cookies /
 *   localStorage to a per-worker JSON file in e2e/.auth/.  This means login
 *   happens at most `workers` times per run, not once per test.
 *
 * storageState (built-in override):
 *   Feeds the saved auth file into Playwright's built-in context factory so
 *   every `page` fixture created by this extended `test` object already carries
 *   the authenticated session. trace / video / screenshot continue to work
 *   because the standard `page` fixture is still used.
 *
 * loggedInPage:
 *   A transparent alias for `page`. Tests that previously called devLogin() on
 *   every case now get a pre-authenticated page for free.
 *
 * Tests that intentionally use an unauthenticated context (e.g. auth.spec.ts)
 * import from '@playwright/test' directly, bypassing this fixture entirely.
 */
export const test = base.extend<{ loggedInPage: Page }, WorkerFixtures>({
  workerStorageState: [
    async ({ browser }, use) => {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
      const storageFile = path.join(
        AUTH_DIR,
        `worker-${test.info().parallelIndex}.json`,
      );

      const context = await browser.newContext({
        baseURL: process.env.BASE_URL ?? 'https://localhost:3000',
        ignoreHTTPSErrors: true,
      });
      const page = await context.newPage();
      await devLogin(page);
      await context.storageState({ path: storageFile });
      await context.close();

      await use(storageFile);
    },
    { scope: 'worker' },
  ],

  // Override the built-in storageState fixture so Playwright's context factory
  // initialises every page with the worker's authenticated session.
  storageState: ({ workerStorageState }, use) => use(workerStorageState),

  loggedInPage: async ({ page }, use) => {
    await use(page);
  },
});

export { expect };
