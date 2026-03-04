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
      page.getByRole('heading', { name: /Terraform Binary Mirrors/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows cards or empty state after loading', async ({ page }) => {
    await page.goto('/terraform-binaries');

    // Wait until either a card or the empty-state h6 appears (neither shows during loading)
    await page.waitForSelector('[class*="MuiCard"], h6', { timeout: 20_000 });

    const hasCards = (await page.locator('[class*="MuiCard"]').count()) > 0;
    const hasEmptyState = await page
      .getByText(/no binary mirrors configured/i)
      .isVisible()
      .catch(() => false);

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
    ).toBeVisible({ timeout: 10_000 });
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

    await page.waitForURL('**/terraform-binaries/**', { timeout: 10_000 });
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
    await page.waitForURL('**/terraform-binaries/**', { timeout: 10_000 });

    // Wait for detail page to settle
    const detailSpinner = page.locator('[class*="MuiCircularProgress"]').first();
    const detailSpinnerVisible = await detailSpinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (detailSpinnerVisible) {
      await expect(detailSpinner).toBeHidden({ timeout: 20_000 });
    }

    await page.waitForSelector('[class*="MuiContainer"], [class*="MuiPaper"]', {
      timeout: 10_000,
    });

    const content = await page
      .locator('[class*="MuiContainer"]')
      .first()
      .textContent();
    expect(content).toBeTruthy();
    expect(content!.trim().length).toBeGreaterThan(5);
  });
});
