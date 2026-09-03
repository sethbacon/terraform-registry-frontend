import { test, expect } from '@playwright/test';

/**
 * Terraform Binary Mirrors public page E2E tests.
 *
 * These pages are publicly accessible (no authentication required).
 *
 * Covers:
 *  - /terraform-binaries list page loads with heading
 *  - Cards show "View Details" button (validates PR 2 label fix)
 *  - Clicking a card navigates to the detail page
 *  - Detail page loads with mirror info
 */

test.describe('Terraform Binaries list', () => {
  test('page loads with heading', async ({ page }) => {
    await page.goto('/terraform-binaries');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await expect(
      page.getByRole('heading', { name: /Hosted Binary Mirrors/i })
    ).toBeVisible();
  });

  test('shows cards or empty state after loading', async ({ page }) => {
    await page.goto('/terraform-binaries');

    // Wait until either a card or the empty-state h6 appears (neither shows during loading)
    await expect(page.locator('[class*="MuiCard"], h6').first()).toBeVisible({ timeout: 20_000 });

    const hasCards = (await page.locator('[class*="MuiCard"]').count()) > 0;
    const hasEmptyState = await page
      .getByText(/no binary mirrors configured/i)
      .isVisible()
      .catch(() => false);

    // Page should show binary mirror cards or a "no binary mirrors configured" empty state
    expect(hasCards || hasEmptyState).toBe(true);
  });

  test('cards show "View Details" button', async ({ page }) => {
    await page.goto('/terraform-binaries');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    const hasCards = (await page.locator('[class*="MuiCard"]').count()) > 0;
    if (!hasCards) {
      test.skip(true, 'No binary mirror cards in test environment — skipping button label check');
    }

    // PR 2 fix: button should say "View Details" not "View Versions"
    await expect(
      page.getByRole('button', { name: /View Details/i }).first()
    ).toBeVisible();
  });

  test('clicking a card navigates to the detail page', async ({ page }) => {
    await page.goto('/terraform-binaries');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    const hasCards = (await page.locator('[class*="MuiCard"]').count()) > 0;
    if (!hasCards) {
      test.skip(true, 'No binary mirror cards in test environment — skipping navigation test');
    }

    await page.getByRole('button', { name: /View Details/i }).first().click();

    await page.waitForURL('**/terraform-binaries/**');
    expect(page.url()).toMatch(/\/terraform-binaries\/.+/);
  });
});

test.describe('Terraform Binary detail page', () => {
  test('detail page loads with mirror information', async ({ page }) => {
    await page.goto('/terraform-binaries');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    const hasCards = (await page.locator('[class*="MuiCard"]').count()) > 0;
    test.skip(!hasCards, 'No binary mirror cards in test environment — skipping detail page test');

    await page.getByRole('button', { name: /View Details/i }).first().click();
    await page.waitForURL('**/terraform-binaries/**');

    // Wait for detail page to settle
    const detailSpinner = page.locator('[class*="MuiCircularProgress"]').first();
    const detailSpinnerVisible = await detailSpinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (detailSpinnerVisible) {
      await expect(detailSpinner).toBeHidden({ timeout: 20_000 });
    }

    await expect(
      page.locator('[class*="MuiContainer"], [class*="MuiPaper"]').first(),
    ).toBeVisible();

    const content = await page
      .locator('[class*="MuiContainer"]')
      .first()
      .textContent();
    expect(content).not.toBeNull();
    expect(content!.trim().length).toBeGreaterThan(5);
  });
});
