import { test, expect } from '@playwright/test';

/**
 * Audit Logs E2E tests.
 *
 * Covers:
 *  - Page loads with correct heading
 *  - Table column headers are visible
 *  - Export button is present
 *  - Filter controls are visible
 *  - Unauthenticated access redirects to /login
 */

// ---------------------------------------------------------------------------
// Helper: dev-login and navigate to audit logs page
// ---------------------------------------------------------------------------

async function devLoginAndGoToAuditLogs(page: import('@playwright/test').Page) {
  await page.goto('/login');
  const devLoginBtn = page.getByRole('button', { name: 'Dev Login (Admin)' });
  const isDevMode = await devLoginBtn.isVisible({ timeout: 3_000 }).catch(() => false);
  return { isDevMode, devLoginBtn };
}

// ---------------------------------------------------------------------------
// Authenticated tests
// ---------------------------------------------------------------------------

test.describe('Audit Logs page (authenticated)', () => {
  test('page loads with Audit Logs heading', async ({ page }) => {
    const { isDevMode, devLoginBtn } = await devLoginAndGoToAuditLogs(page);
    test.skip(!isDevMode, 'Dev login not available — backend not running in DEV_MODE');

    await devLoginBtn.click();
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 10_000 });

    await page.goto('/admin/audit-logs');
    await expect(page.getByRole('heading', { name: 'Audit Logs' })).toBeVisible({ timeout: 10_000 });
  });

  test('page shows table column headers', async ({ page }) => {
    const { isDevMode, devLoginBtn } = await devLoginAndGoToAuditLogs(page);
    test.skip(!isDevMode, 'Dev login not available — backend not running in DEV_MODE');

    await devLoginBtn.click();
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 10_000 });

    await page.goto('/admin/audit-logs');
    await expect(page.getByRole('heading', { name: 'Audit Logs' })).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole('columnheader', { name: 'Timestamp' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Action' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Resource' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'User' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'IP Address' })).toBeVisible();
  });

  test('export button is visible', async ({ page }) => {
    const { isDevMode, devLoginBtn } = await devLoginAndGoToAuditLogs(page);
    test.skip(!isDevMode, 'Dev login not available — backend not running in DEV_MODE');

    await devLoginBtn.click();
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 10_000 });

    await page.goto('/admin/audit-logs');
    await expect(page.getByRole('heading', { name: 'Audit Logs' })).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole('button', { name: /export/i })).toBeVisible();
  });

  test('filter controls are visible', async ({ page }) => {
    const { isDevMode, devLoginBtn } = await devLoginAndGoToAuditLogs(page);
    test.skip(!isDevMode, 'Dev login not available — backend not running in DEV_MODE');

    await devLoginBtn.click();
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 10_000 });

    await page.goto('/admin/audit-logs');
    await expect(page.getByRole('heading', { name: 'Audit Logs' })).toBeVisible({ timeout: 10_000 });

    await expect(page.getByLabel('Start Date')).toBeVisible();
    await expect(page.getByLabel('End Date')).toBeVisible();
    await expect(page.locator('[data-testid="resource-type-select"]')).toBeVisible();
    await expect(page.getByLabel('User Email')).toBeVisible();
  });

  test('audit logs appears in sidebar navigation', async ({ page }) => {
    const { isDevMode, devLoginBtn } = await devLoginAndGoToAuditLogs(page);
    test.skip(!isDevMode, 'Dev login not available — backend not running in DEV_MODE');

    await devLoginBtn.click();
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 10_000 });

    await expect(page.getByRole('link', { name: 'Audit Logs' })).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Unauthenticated access
// ---------------------------------------------------------------------------

test.describe('Audit Logs — unauthenticated access', () => {
  test('redirects to /login for unauthenticated users', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto('/admin/audit-logs');

    await page.waitForURL('**/login', { timeout: 10_000 });
    expect(page.url()).toContain('/login');

    await context.close();
  });
});
