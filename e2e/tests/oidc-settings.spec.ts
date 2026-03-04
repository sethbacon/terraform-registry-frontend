import { test, expect } from '../fixtures/auth';
import { test as base } from '@playwright/test';

/**
 * OIDC Groups admin page E2E tests.
 *
 * Covers:
 *  - /admin/oidc page loads with heading
 *  - Active provider summary or group mapping section is present
 *  - Save Changes button is visible
 *  - Add Mapping dialog opens with required fields
 *  - Organization field uses Autocomplete (validates PR 2 fix C)
 *  - Unauthenticated access redirects to /login
 */

test.describe('Admin: OIDC Groups', () => {
  test('page loads with heading', async ({ loggedInPage: page }) => {
    await page.goto('/admin/oidc');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await expect(
      page.getByRole('heading', { name: /OIDC Groups/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('page shows group mapping section with Save Changes button', async ({ loggedInPage: page }) => {
    await page.goto('/admin/oidc');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await expect(
      page.getByRole('button', { name: /Save Changes/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('page has Add Mapping button', async ({ loggedInPage: page }) => {
    await page.goto('/admin/oidc');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await expect(
      page.getByRole('button', { name: /Add Mapping/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Add Mapping dialog opens with required fields', async ({ loggedInPage: page }) => {
    await page.goto('/admin/oidc');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await page.getByRole('button', { name: /Add Mapping/i }).click();

    // Dialog should open
    await expect(
      page.getByRole('heading', { name: /Add Group Mapping/i })
    ).toBeVisible({ timeout: 5_000 });

    // IdP Group field must be present
    await expect(page.getByLabel(/IdP Group/i)).toBeVisible({ timeout: 5_000 });

    // Add button in dialog
    const addBtn = page
      .locator('[class*="MuiDialog"]')
      .getByRole('button', { name: /^Add$/i });
    await expect(addBtn).toBeVisible({ timeout: 5_000 });
  });

  test('Add Mapping dialog Organization field uses Autocomplete', async ({ loggedInPage: page }) => {
    await page.goto('/admin/oidc');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await page.getByRole('button', { name: /Add Mapping/i }).click();

    await expect(
      page.getByRole('heading', { name: /Add Group Mapping/i })
    ).toBeVisible({ timeout: 5_000 });

    // PR 2 fix: Organization field should be an MUI Autocomplete (not a plain TextField)
    // Use role=combobox which is the accessible role of an MUI Autocomplete input
    const dialog = page.locator('[class*="MuiDialog"]');
    const autocomplete = dialog.getByRole('combobox', { name: /Organization/i });
    await expect(autocomplete).toBeVisible({ timeout: 5_000 });
  });

  test('Add Mapping dialog Add button is disabled with empty fields', async ({ loggedInPage: page }) => {
    await page.goto('/admin/oidc');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await page.getByRole('button', { name: /Add Mapping/i }).click();

    await expect(
      page.getByRole('heading', { name: /Add Group Mapping/i })
    ).toBeVisible({ timeout: 5_000 });

    // With no IdP Group or Organization filled in, the Add button should be disabled
    const addBtn = page
      .locator('[class*="MuiDialog"]')
      .getByRole('button', { name: /^Add$/i });
    await expect(addBtn).toBeDisabled({ timeout: 5_000 });
  });
});

test.describe('Admin: OIDC Groups — unauthenticated', () => {
  base('unauthenticated access redirects to /login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto('/admin/oidc');

    await page.waitForURL('**/login', { timeout: 10_000 });
    expect(page.url()).toContain('/login');

    await context.close();
  });
});
