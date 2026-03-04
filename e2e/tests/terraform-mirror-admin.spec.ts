import { test, expect } from '../fixtures/auth';
import { test as base } from '@playwright/test';

/**
 * Terraform Binary Mirrors admin page E2E tests.
 *
 * Covers:
 *  - /admin/terraform-mirror page loads with heading
 *  - Page shows cards or empty state
 *  - Refresh and Add Mirror buttons are present (validates PR 1 refresh consistency)
 *  - Add Mirror dialog opens and has required fields
 *  - Unauthenticated access redirects to /login
 */

test.describe('Admin: Terraform Binary Mirrors', () => {
  test('page loads with heading', async ({ loggedInPage: page }) => {
    await page.goto('/admin/terraform-mirror');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await expect(
      page.getByRole('heading', { name: /Binaries Config/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows cards or empty state', async ({ loggedInPage: page }) => {
    await page.goto('/admin/terraform-mirror');

    // Wait for loading to complete: MuiAlert (empty state) or MuiCard (configs) appears after spinner gone
    await page.waitForSelector('[class*="MuiAlert"], [class*="MuiCard"]', { timeout: 20_000 });

    const hasCards = (await page.locator('[class*="MuiCard"]').count()) > 0;
    const hasEmptyState = await page
      .getByText(/configurations exist yet/i)
      .isVisible()
      .catch(() => false);

    expect(hasCards || hasEmptyState).toBe(true);
  });

  test('page has labelled Refresh and Add Mirror buttons', async ({ loggedInPage: page }) => {
    await page.goto('/admin/terraform-mirror');

    // Wait for page to finish loading (info banner always appears after spinner)
    await page.waitForSelector('[class*="MuiAlert"]', { timeout: 20_000 });

    // PR 1 fix: Refresh should be a labelled outlined button, not an icon-only button
    await expect(
      page.getByRole('button', { name: /^Refresh$/i })
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByRole('button', { name: /Add Mirror/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Add Mirror dialog opens with required fields', async ({ loggedInPage: page }) => {
    await page.goto('/admin/terraform-mirror');

    // Wait for page to finish loading (info banner always appears after spinner)
    await page.waitForSelector('[class*="MuiAlert"]', { timeout: 20_000 });

    await page.getByRole('button', { name: /Add Mirror/i }).click();

    // Dialog should open
    await expect(
      page.locator('[class*="MuiDialog"]').first()
    ).toBeVisible({ timeout: 5_000 });

    // Name field and Tool select should be present
    await expect(page.getByLabel(/Name/i).first()).toBeVisible({ timeout: 5_000 });

    // Create button should be present in the dialog
    const createBtn = page.locator('[class*="MuiDialog"]').getByRole('button', { name: /Create/i });
    await expect(createBtn).toBeVisible({ timeout: 5_000 });
  });

  test('cards show "View Details" button', async ({ loggedInPage: page }) => {
    await page.goto('/admin/terraform-mirror');

    // Wait for page to finish loading (info banner always appears after spinner)
    await page.waitForSelector('[class*="MuiAlert"]', { timeout: 20_000 });

    const hasCards = (await page.locator('[class*="MuiCard"]').count()) > 0;
    if (!hasCards) {
      test.skip(true, 'No binary mirror configs in test environment — skipping card button check');
    }

    // PR 2 fix: button should say "View Details" not "Versions"
    await expect(
      page.getByRole('button', { name: /View Details/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Admin: Terraform Binary Mirrors — unauthenticated', () => {
  base('unauthenticated access redirects to /login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto('/admin/terraform-mirror');

    await page.waitForURL('**/login', { timeout: 10_000 });
    expect(page.url()).toContain('/login');

    await context.close();
  });
});
