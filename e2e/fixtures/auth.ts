import { test as base, expect, type Page } from '@playwright/test';

/**
 * Logs in via the "Dev Login (Admin)" button on the login page.
 * This requires the backend to be running with DEV_MODE=true.
 *
 * Returns the authenticated Page object for use in tests.
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

/**
 * Custom fixture that provides a page already authenticated as admin.
 */
export const test = base.extend<{ loggedInPage: Page }>({
  loggedInPage: async ({ page }, use) => {
    await devLogin(page);
    await use(page);
  },
});

export { expect };
