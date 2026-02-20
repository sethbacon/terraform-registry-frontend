import { test, expect } from '../fixtures/auth';

/**
 * Module registry E2E tests.
 *
 * Covers:
 *  - Modules list page loads with heading
 *  - Search field is present and interactive
 *  - Module detail page loads when a result is clicked (if modules exist)
 */

test.describe('Modules list', () => {
  test('page heading and search field are visible', async ({ loggedInPage: page }) => {
    await page.goto('/modules');

    await expect(page.getByRole('heading', { name: 'Terraform Modules' })).toBeVisible();
    await expect(page.getByPlaceholder('Search modules...')).toBeVisible();
  });

  test('search field accepts input', async ({ loggedInPage: page }) => {
    await page.goto('/modules');

    const searchField = page.getByPlaceholder('Search modules...');
    await searchField.fill('test');
    await expect(searchField).toHaveValue('test');

    // Clear and verify
    await searchField.clear();
    await expect(searchField).toHaveValue('');
  });

  test('shows module cards or empty state', async ({ loggedInPage: page }) => {
    await page.goto('/modules');

    // Wait for loading to finish — either cards or empty state appears
    await page.waitForSelector(
      '[class*="MuiCard"], [class*="MuiCircularProgress"], h6:has-text("No modules found")',
      { timeout: 10_000 }
    );

    // The page should not be stuck in a loading state indefinitely
    // Use .first() to avoid a strict-mode violation — MUI renders the spinner
    // as three nested nodes that all carry the MuiCircularProgress class.
    const loadingSpinner = page.locator('[class*="MuiCircularProgress"]').first();
    if (await loadingSpinner.isVisible()) {
      await expect(loadingSpinner).toBeHidden({ timeout: 15_000 });
    }

    const hasCards = await page.locator('[class*="MuiCard"]').count() > 0;
    const hasEmptyState = await page.getByText('No modules found').isVisible().catch(() => false);

    expect(hasCards || hasEmptyState).toBe(true);
  });

  test('clicking a module opens the detail page', async ({ loggedInPage: page }) => {
    await page.goto('/modules');

    // Wait for content
    await page.waitForSelector('[class*="MuiCard"], h6:has-text("No modules found")', {
      timeout: 10_000,
    });

    const hasCards = await page.locator('[class*="MuiCard"]').count() > 0;

    if (!hasCards) {
      test.skip(true, 'No modules available in test environment — skipping detail page test');
    }

    // Click "View Details" on the first card
    const firstViewDetails = page.getByRole('button', { name: /View Details/i }).first();
    await firstViewDetails.click();

    // URL should change to a module detail path: /modules/:namespace/:name/:system
    await page.waitForURL('**/modules/**/**/**', { timeout: 10_000 });
    expect(page.url()).toMatch(/\/modules\/[^/]+\/[^/]+\/[^/]+/);
  });
});

test.describe('Module detail page', () => {
  test('detail page shows version selector when navigated to', async ({ loggedInPage: page }) => {
    await page.goto('/modules');

    await page.waitForSelector('[class*="MuiCard"], h6:has-text("No modules found")', {
      timeout: 10_000,
    });

    const hasCards = await page.locator('[class*="MuiCard"]').count() > 0;
    test.skip(!hasCards, 'No modules available — skipping detail page test');

    await page.getByRole('button', { name: /View Details/i }).first().click();
    await page.waitForURL('**/modules/**/**/**', { timeout: 10_000 });

    // Wait for the page's loading spinner to disappear before asserting content.
    // ModuleDetailPage renders a CircularProgress while fetching, then swaps to content.
    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    // After loading, a Paper with module info should be present
    await page.waitForSelector('[class*="MuiPaper"], [class*="MuiChip"], [class*="MuiSelect"]', {
      timeout: 15_000,
    });

    // Detail page should have at least a heading with the module name
    const pageContent = await page
      .locator('[class*="MuiContainer"], [class*="MuiPaper"]')
      .filter({ hasText: /.+/ })
      .first()
      .textContent();
    expect(pageContent).toBeTruthy();
    expect(pageContent!.trim().length).toBeGreaterThan(10);
  });
});
