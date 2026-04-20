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

    // At least one of the login buttons should be visible.
    // Use a combined locator with auto-retry (toBeVisible) instead of point-in-time
    // isVisible() checks, which are fragile during React hydration.
    const anyLoginButton = page.getByRole('button', { name: /Dev Login \(Admin\)|Sign in with OIDC|Sign in with Azure AD/ });
    await expect(anyLoginButton.first()).toBeVisible();
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
  test('logout returns user to home page', async ({ page }) => {
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

    // Logout redirects to the backend /auth/logout endpoint which terminates any
    // OIDC SSO session and then redirects back to the frontend home page ('/').
    // In dev mode (no OIDC) the backend falls back directly to the home page.
    // 30 s — covers the backend redirect latency + full SPA page load on slow CI runners.
    await page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 });
    expect(page.url()).not.toContain('/login');

    // Security check: swagger-ui-react persists Authorize dialog entries under
    // the key "authorized" in localStorage.  AuthContext.logout() must clear it
    // so API keys do not leak across sessions.
    const swaggerAuth = await page.evaluate(() => localStorage.getItem('authorized'));
    expect(swaggerAuth).toBeNull();
  });
});

test.describe('Provider probing (UX roadmap 1.2)', () => {
  test('does not render OIDC button when the OIDC probe is unreachable', async ({ page }) => {
    // Intercept ONLY the probe request (mount-time, manual-redirect GET)
    // and force it to fail. Real login redirects still work for other providers.
    await page.route('**/api/v1/auth/login?provider=oidc', (route) => route.abort());

    await page.goto('/login');

    // Wait for the probe loading state to disappear.
    await expect(page.getByTestId('provider-probing')).toHaveCount(0, { timeout: 10_000 });

    await expect(page.getByRole('button', { name: 'Sign in with SSO' })).toHaveCount(0);
  });

  test('shows inline alert (not ErrorBoundary) when dev login endpoint fails', async ({ page }) => {
    // Register the route mock BEFORE navigating so it is guaranteed to be in
    // place before the browser dispatches any matching requests.
    await page.route('**/api/v1/dev/login', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'dev login exploded' }),
      })
    );

    await page.goto('/login');

    const devLoginBtn = page.getByRole('button', { name: 'Dev Login (Admin)' });
    const isDevMode = await devLoginBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    test.skip(!isDevMode, 'Dev login not available — backend not running in DEV_MODE');

    await devLoginBtn.click();

    // The inline error alert should appear (handleDevLogin catch block).
    // Use a filter to avoid strict-mode violation — the page also has the
    // "Development mode" info alert (and potentially a no-providers alert).
    const errorAlert = page.getByRole('alert').filter({ hasText: /failed|error/i });
    await expect(errorAlert).toBeVisible({ timeout: 5_000 });

    // Page should NOT crash into the ErrorBoundary fallback.
    await expect(page.getByText(/Something went wrong/i)).toHaveCount(0);
    // The dev login button stays visible on the login page.
    await expect(devLoginBtn).toBeVisible();
  });
});
