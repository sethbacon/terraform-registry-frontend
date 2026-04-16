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
 *  - API Documentation page loads Swagger UI content
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

    await expect(page.getByRole('heading', { name: "What's Available" })).toBeVisible();

    // Feature cards should be rendered
    const cards = page.locator('[class*="MuiCard"]');
    await expect(cards.first()).toBeVisible();
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);
  });

  test('renders Getting Started section with 3 steps', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Getting Started' })).toBeVisible();
    await expect(page.getByText('1. Sign In')).toBeVisible();
    await expect(page.getByText('2. Get an API Key')).toBeVisible();
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

  test('quick search navigates to /modules via Enter key (roadmap 3.4)', async ({ page }) => {
    await page.goto('/');
    const input = page.getByRole('textbox', { name: /Search modules/i });
    await input.fill('example');
    await input.press('Enter');
    await page.waitForURL(/\/modules\?q=example/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/modules\?q=example/);
  });

  test('quick search toggles placeholder and routes to /providers (roadmap 3.4)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Providers' }).click();
    const input = page.getByRole('textbox', { name: /Search providers/i });
    await expect(input).toBeVisible();
    await input.fill('aws');
    await input.press('Enter');
    await page.waitForURL(/\/providers\?q=aws/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/providers\?q=aws/);
  });
});

test.describe('Getting Started API key CTA (roadmap 1.1)', () => {
  test('unauthenticated visitor sees Sign-in CTA', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    try {
      await page.goto('/');
      await expect(page.getByTestId('getting-started-signin')).toBeVisible();
      await expect(page.getByTestId('getting-started-create-key')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('authenticated user can open QuickApiKeyDialog', async ({ page }) => {
    await page.goto('/login');
    const devLoginBtn = page.getByRole('button', { name: 'Dev Login (Admin)' });
    const isDevMode = await devLoginBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    test.skip(!isDevMode, 'Dev login not available — backend not running in DEV_MODE');

    await devLoginBtn.click();
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 10_000 });
    await page.goto('/');
    const createBtn = page.getByTestId('getting-started-create-key');
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await createBtn.click();
    await expect(page.getByRole('dialog', { name: /Create API key/i })).toBeVisible();
  });
});

test.describe('API Documentation page', () => {
  test('page loads and shows API documentation heading', async ({ page }) => {
    await page.goto('/api-docs');

    // The MUI page title heading is rendered immediately on mount
    await expect(
      page.getByRole('heading', { name: 'API Swagger Documentation' })
    ).toBeVisible({ timeout: 10_000 });

    // Subtitle describing how to authenticate should also be present
    await expect(
      page.getByText('Interactive API reference')
    ).toBeVisible({ timeout: 5_000 });

    // Wait for Swagger UI to mount — the JS chunk is ~1.3 MB so allow extra time.
    // Swagger UI renders a .swagger-ui root div; the .info section appears once
    // the spec has been fetched and parsed.
    await page.waitForSelector(
      '.swagger-ui, [class*="MuiCircularProgress"], [role="progressbar"]',
      { timeout: 30_000 }
    );

    // If a spinner is still visible give it time to finish
    const spinner = page.locator('[class*="MuiCircularProgress"], [role="progressbar"]').first();
    if (await spinner.isVisible()) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    // Swagger UI has rendered the spec when operation blocks are visible.
    // The .info element is present but may be scrolled out of Playwright's
    // visibility check; assert on an opblock which is always in-view.
    await expect(page.locator('.swagger-ui .opblock').first()).toBeVisible({ timeout: 20_000 });

    // Page should render some meaningful content
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).not.toBeNull();
    expect(pageContent!.length).toBeGreaterThan(50);
  });

  test('API docs page does not show a fatal error alert', async ({ page }) => {
    await page.goto('/api-docs');

    // Wait for Swagger UI to mount before checking for errors
    await page.waitForSelector('.swagger-ui', { timeout: 30_000 });

    // A red MUI error Alert should not be visible
    const errorAlert = page.locator('[class*="MuiAlert-standardError"], [class*="MuiAlert-filledError"]');
    const hasError = await errorAlert.isVisible().catch(() => false);
    expect(hasError).toBe(false);
  });
});
