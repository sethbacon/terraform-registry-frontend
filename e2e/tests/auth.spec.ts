import { test, expect } from '@playwright/test';

/**
 * Authentication E2E tests.
 *
 * Covers:
 *  - Login page renders correctly
 *  - Dev login flow redirects to main app
 *  - Invalid/missing auth on a protected route redirects to login
 *  - Logout returns user to login page
 */

test.describe('Login page', () => {
  test('renders login buttons', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Terraform Registry' })).toBeVisible();
    await expect(page.getByText('Sign in to continue')).toBeVisible();

    // At least one of the login buttons should be visible
    const devBtn = page.getByRole('button', { name: 'Dev Login (Admin)' });
    const oidcBtn = page.getByRole('button', { name: 'Sign in with OIDC' });
    const azureBtn = page.getByRole('button', { name: 'Sign in with Azure AD' });

    const anyVisible =
      (await devBtn.isVisible()) ||
      (await oidcBtn.isVisible()) ||
      (await azureBtn.isVisible());

    expect(anyVisible).toBe(true);
  });

  test('dev login redirects away from /login', async ({ page }) => {
    await page.goto('/login');

    const devLoginBtn = page.getByRole('button', { name: 'Dev Login (Admin)' });

    // Skip test if dev mode is not available
    const isDevMode = await devLoginBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    test.skip(!isDevMode, 'Dev login not available — backend not running in DEV_MODE');

    await devLoginBtn.click();

    // Should navigate away from /login
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 10_000 });
    expect(page.url()).not.toContain('/login');
  });
});

test.describe('Protected route redirect', () => {
  test('unauthenticated access to /admin/users redirects to /login', async ({ browser }) => {
    // Use a fresh context with no stored auth
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto('/admin/users');

    // Should redirect to login (React Router ProtectedRoute redirects client-side)
    await page.waitForURL('**/login', { timeout: 10_000 });
    expect(page.url()).toContain('/login');

    await context.close();
  });
});

test.describe('Logout', () => {
  test('logout returns user to login page', async ({ page }) => {
    await page.goto('/login');

    const devLoginBtn = page.getByRole('button', { name: 'Dev Login (Admin)' });
    const isDevMode = await devLoginBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    test.skip(!isDevMode, 'Dev login not available — backend not running in DEV_MODE');

    await devLoginBtn.click();
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 10_000 });

    // Open account menu (top-right AppBar button)
    const accountMenuBtn = page.getByRole('button', { name: /account of current user/i });
    const fallbackMenuBtn = page.locator('[aria-label*="account"]').first();

    const menuBtn = (await accountMenuBtn.isVisible().catch(() => false))
      ? accountMenuBtn
      : fallbackMenuBtn;

    await menuBtn.click();

    // Click Logout menu item
    await page.getByRole('menuitem', { name: 'Logout' }).click();

    // Should be back at /login
    await page.waitForURL('**/login', { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });
});
