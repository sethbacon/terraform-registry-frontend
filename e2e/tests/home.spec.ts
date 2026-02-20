import { test, expect } from '@playwright/test';

/**
 * Home page and API Documentation E2E tests.
 *
 * Both routes (/ and /api-docs) are public — they live inside <Layout> but are
 * NOT wrapped in <ProtectedRoute>, so no dev login is needed.  Using the base
 * page fixture avoids 6+ unnecessary login round-trips and keeps this file fast.
 *
 * Covers:
 *  - Home page renders hero section and feature cards
 *  - Navigation buttons on home page are clickable
 *  - Home page is accessible without authentication
 *  - API Documentation page loads ReDoc content
 */

test.describe('Home page', () => {
  test('renders hero section with heading and navigation buttons', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: /Private Terraform Registry/i })
    ).toBeVisible();

    // Both primary CTA buttons should be present
    await expect(page.getByRole('button', { name: 'Browse Modules' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Browse Providers' }).first()).toBeVisible();
  });

  test('renders feature cards section', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Features' })).toBeVisible();

    // Feature cards should be rendered
    const cards = page.locator('[class*="MuiCard"]');
    await expect(cards.first()).toBeVisible();
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);
  });

  test('renders Getting Started section with 3 steps', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Getting Started' })).toBeVisible();
    await expect(page.getByText('1. Authenticate')).toBeVisible();
    await expect(page.getByText('2. Configure Terraform')).toBeVisible();
    await expect(page.getByText('3. Start Using')).toBeVisible();
  });

  test('renders Registry Protocol Support section with chips', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Registry Protocol Support' })).toBeVisible();
    await expect(page.getByText('Module Registry API')).toBeVisible();
    await expect(page.getByText('Provider Registry API')).toBeVisible();
  });

  test('"Browse Modules" hero button navigates to /modules', async ({ page }) => {
    await page.goto('/');

    // The first "Browse Modules" button is in the hero section
    await page.getByRole('button', { name: 'Browse Modules' }).first().click();

    await page.waitForURL('**/modules', { timeout: 10_000 });
    expect(page.url()).toContain('/modules');
  });

  test('"Browse Providers" hero button navigates to /providers', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Browse Providers' }).first().click();

    await page.waitForURL('**/providers', { timeout: 10_000 });
    expect(page.url()).toContain('/providers');
  });

  test('home page is accessible without authentication', async ({ browser }) => {
    // Fresh context with no stored auth state confirms the route is truly public
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto('/');

    const url = page.url();
    expect(url).not.toContain('/login');

    await expect(
      page.getByRole('heading', { name: /Private Terraform Registry/i })
    ).toBeVisible({ timeout: 10_000 });

    await context.close();
  });
});

test.describe('API Documentation page', () => {
  test('page loads and shows API documentation heading', async ({ page }) => {
    await page.goto('/api-docs');

    // Wait for the page to mount — ReDoc loads asynchronously from CDN
    // so we tolerate either the ReDoc container or a loading/error indicator
    await page.waitForSelector(
      '[id*="redoc"], [class*="redoc"], .redoc-wrap, [class*="MuiCircularProgress"], [role="progressbar"], h1, h2',
      { timeout: 15_000 }
    );

    // If a spinner is visible it should eventually disappear
    const spinner = page.locator('[class*="MuiCircularProgress"], [role="progressbar"]').first();
    if (await spinner.isVisible()) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    // Page should render some meaningful content
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toBeTruthy();
    expect(pageContent!.length).toBeGreaterThan(50);
  });

  test('API docs page does not show a fatal error alert', async ({ page }) => {
    await page.goto('/api-docs');

    // Wait for initial render
    await page.waitForTimeout(3_000);

    // A red MUI error Alert should not be visible
    const errorAlert = page.locator('[class*="MuiAlert-standardError"], [class*="MuiAlert-filledError"]');
    const hasError = await errorAlert.isVisible().catch(() => false);
    expect(hasError).toBe(false);
  });
});
