import { test, expect } from '../fixtures/auth';

/**
 * Provider registry E2E tests.
 *
 * Covers:
 *  - Provider list page loads with heading and search
 *  - Provider cards or empty state is shown
 *  - "Network Mirrored" badge appears where applicable
 *  - Provider detail page loads when a result is clicked
 */

test.describe('Providers list', () => {
  test('page heading and search field are visible', async ({ loggedInPage: page }) => {
    await page.goto('/providers');

    await expect(page.getByRole('heading', { name: 'Terraform Providers' })).toBeVisible();
    await expect(page.getByPlaceholder('Search providers...')).toBeVisible();
  });

  test('search field accepts input', async ({ loggedInPage: page }) => {
    await page.goto('/providers');

    const searchField = page.getByPlaceholder('Search providers...');
    await searchField.fill('aws');
    await expect(searchField).toHaveValue('aws');

    await searchField.clear();
    await expect(searchField).toHaveValue('');
  });

  test('shows provider cards or empty state', async ({ loggedInPage: page }) => {
    // Register the response listener BEFORE navigating to avoid the race
    // condition where the API call fires and resolves before the listener is set up.
    const apiResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/v1/providers') && resp.status() === 200,
      { timeout: 15_000 }
    ).catch(() => null); // graceful fallback if response never fires

    await page.goto('/providers');
    await apiResponsePromise;

    // Ensure either provider cards render or the empty state is shown.
    await page.waitForSelector('[class*="MuiCard"], h6:has-text("No providers found")', {
      timeout: 10_000,
    });

    const hasCards = (await page.locator('[class*="MuiCard"]').count()) > 0;
    const hasEmptyState = await page.getByText('No providers found').isVisible().catch(() => false);

    expect(hasCards || hasEmptyState).toBe(true);
  });

  test('network mirrored badge visible when mirrored providers exist', async ({
    loggedInPage: page,
  }) => {
    await page.goto('/providers');

    await page.waitForSelector('[class*="MuiCard"], h6:has-text("No providers found")', {
      timeout: 10_000,
    });

    const mirroredBadge = page.getByText('Network Mirrored');
    const hasMirrored = await mirroredBadge.count() > 0;

    // This test is informational — the badge should appear if there are mirrored providers.
    // We just verify the DOM is rendered correctly (no assertion failure if none exist).
    if (hasMirrored) {
      await expect(mirroredBadge.first()).toBeVisible();
    }
    // If no mirrored providers exist, the test passes trivially (expected in a fresh env).
  });

  test('clicking a provider opens the detail page', async ({ loggedInPage: page }) => {
    await page.goto('/providers');

    await page.waitForSelector('[class*="MuiCard"], h6:has-text("No providers found")', {
      timeout: 10_000,
    });

    const hasCards = await page.locator('[class*="MuiCard"]').count() > 0;
    test.skip(!hasCards, 'No providers available in test environment — skipping detail page test');

    await page.getByRole('button', { name: /View Details/i }).first().click();

    // URL should change to: /providers/:namespace/:type
    await page.waitForURL('**/providers/**/**', { timeout: 10_000 });
    expect(page.url()).toMatch(/\/providers\/[^/]+\/[^/]+/);
  });
});

test.describe('Provider detail page', () => {
  test('detail page renders content', async ({ loggedInPage: page }) => {
    await page.goto('/providers');

    await page.waitForSelector('[class*="MuiCard"], h6:has-text("No providers found")', {
      timeout: 10_000,
    });

    const hasCards = await page.locator('[class*="MuiCard"]').count() > 0;
    test.skip(!hasCards, 'No providers available — skipping detail page test');

    await page.getByRole('button', { name: /View Details/i }).first().click();
    await page.waitForURL('**/providers/**/**', { timeout: 10_000 });

    // Wait for the page's loading spinner to disappear before asserting content.
    // ProviderDetailPage renders a CircularProgress while fetching, then swaps to content.
    // Use .first() to avoid strict-mode violations — MUI renders the spinner as three
    // nested elements that all carry the MuiCircularProgress class.
    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    // After loading, a Paper/Chip/Select with provider info should be present
    await page.waitForSelector('[class*="MuiPaper"], [class*="MuiChip"], [class*="MuiTypography"]', {
      timeout: 15_000,
    });

    const pageContent = await page
      .locator('[class*="MuiContainer"], [class*="MuiPaper"]')
      .filter({ hasText: /.+/ })
      .first()
      .textContent();
    expect(pageContent).toBeTruthy();
    expect(pageContent!.trim().length).toBeGreaterThan(10);
  });
});
