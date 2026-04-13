import { test, expect } from '@playwright/test';

/**
 * Setup Wizard E2E tests.
 *
 * The setup wizard (/setup) is a one-time first-run flow. In the standard
 * E2E test environment the backend has already completed setup, so the wizard
 * redirects to "/". These tests verify:
 *
 *  - Redirect when setup is already completed
 *  - Page renders correctly when setup is NOT completed (mocked API)
 *  - Token authentication step form validation
 *  - Stepper navigation and step labels
 *  - Storage backend type switching
 */

test.describe('Setup Wizard — redirect when complete', () => {
  test('navigating to /setup redirects to / when setup is already completed', async ({ page }) => {
    await page.goto('/setup');

    // The page checks GET /api/v1/setup/status on mount.
    // When setup_completed is true, it navigates to "/" via React Router.
    await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 });
    expect(page.url()).not.toContain('/setup');
  });
});

test.describe('Setup Wizard — page structure (mocked API)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the setup status endpoint to report setup NOT completed
    await page.route('**/api/v1/setup/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ setup_completed: false }),
      }),
    );
  });

  test('renders the setup wizard heading and stepper', async ({ page }) => {
    await page.goto('/setup');

    // Heading
    await expect(
      page.getByRole('heading', { name: 'Terraform Registry Setup' }),
    ).toBeVisible({ timeout: 10_000 });

    // All 5 stepper labels should be present
    const stepLabels = ['Authenticate', 'OIDC Provider', 'Storage Backend', 'Admin User', 'Complete'];
    for (const label of stepLabels) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test('step 0 shows the setup token input and verify button', async ({ page }) => {
    await page.goto('/setup');

    await expect(
      page.getByRole('heading', { name: 'Setup Token' }),
    ).toBeVisible({ timeout: 10_000 });

    // Token text field
    const tokenInput = page.getByLabel('Setup Token');
    await expect(tokenInput).toBeVisible();

    // Verify button is present but disabled when field is empty
    const verifyBtn = page.getByRole('button', { name: 'Verify Token' });
    await expect(verifyBtn).toBeVisible();
    await expect(verifyBtn).toBeDisabled();
  });

  test('verify button enables after entering a token value', async ({ page }) => {
    await page.goto('/setup');

    const tokenInput = page.getByLabel('Setup Token');
    await expect(tokenInput).toBeVisible({ timeout: 10_000 });

    await tokenInput.fill('tfr_setup_test_token_12345');

    const verifyBtn = page.getByRole('button', { name: 'Verify Token' });
    await expect(verifyBtn).toBeEnabled();
  });

  test('invalid token shows an error message', async ({ page }) => {
    // Mock the validate endpoint to return a 401
    await page.route('**/api/v1/setup/validate-token', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid setup token' }),
      }),
    );

    await page.goto('/setup');

    const tokenInput = page.getByLabel('Setup Token');
    await expect(tokenInput).toBeVisible({ timeout: 10_000 });
    await tokenInput.fill('bad_token');

    await page.getByRole('button', { name: 'Verify Token' }).click();

    // Error alert should appear
    await expect(page.getByText('Invalid setup token')).toBeVisible({ timeout: 5_000 });
  });

  test('valid token advances to OIDC step', async ({ page }) => {
    // Mock the validate endpoint to return success
    await page.route('**/api/v1/setup/validate-token', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ valid: true }),
      }),
    );

    await page.goto('/setup');

    const tokenInput = page.getByLabel('Setup Token');
    await expect(tokenInput).toBeVisible({ timeout: 10_000 });
    await tokenInput.fill('tfr_setup_valid_token');

    await page.getByRole('button', { name: 'Verify Token' }).click();

    // Should advance to OIDC step
    await expect(
      page.getByRole('heading', { name: 'OIDC Provider Configuration' }),
    ).toBeVisible({ timeout: 10_000 });

    // OIDC form fields should be visible
    await expect(page.getByLabel('Issuer URL')).toBeVisible();
    await expect(page.getByLabel('Client ID')).toBeVisible();
    await expect(page.getByLabel('Client Secret')).toBeVisible();
    await expect(page.getByLabel('Redirect URL')).toBeVisible();
  });
});

test.describe('Setup Wizard — OIDC & Storage steps (mocked API)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock setup status as incomplete
    await page.route('**/api/v1/setup/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ setup_completed: false }),
      }),
    );

    // Mock token validation as success
    await page.route('**/api/v1/setup/validate-token', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ valid: true }),
      }),
    );
  });

  test('OIDC save button is disabled until required fields are filled', async ({ page }) => {
    await page.goto('/setup');

    // Advance past token step
    const tokenInput = page.getByLabel('Setup Token');
    await expect(tokenInput).toBeVisible({ timeout: 10_000 });
    await tokenInput.fill('tfr_setup_valid_token');
    await page.getByRole('button', { name: 'Verify Token' }).click();

    // Wait for OIDC step
    await expect(
      page.getByRole('heading', { name: 'OIDC Provider Configuration' }),
    ).toBeVisible({ timeout: 10_000 });

    // Save button should be disabled (required fields are empty)
    const saveBtn = page.getByRole('button', { name: 'Save OIDC Configuration' });
    await expect(saveBtn).toBeDisabled();
  });

  test('storage step shows backend type chips', async ({ page }) => {
    // Mock OIDC save endpoint
    await page.route('**/api/v1/setup/oidc', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      }),
    );

    await page.goto('/setup');

    // Advance past token step
    const tokenInput = page.getByLabel('Setup Token');
    await expect(tokenInput).toBeVisible({ timeout: 10_000 });
    await tokenInput.fill('tfr_setup_valid_token');
    await page.getByRole('button', { name: 'Verify Token' }).click();

    // Fill OIDC required fields
    await expect(page.getByLabel('Issuer URL')).toBeVisible({ timeout: 10_000 });
    await page.getByLabel('Issuer URL').fill('https://accounts.example.com');
    await page.getByLabel('Client ID').fill('test-client-id');
    await page.getByLabel('Client Secret').fill('test-client-secret');

    // Save OIDC
    await page.getByRole('button', { name: 'Save OIDC Configuration' }).click();

    // Advance to storage step
    await expect(
      page.getByRole('button', { name: /Next: Configure Storage/i }),
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Next: Configure Storage/i }).click();

    // Storage step heading
    await expect(
      page.getByRole('heading', { name: 'Storage Backend Configuration' }),
    ).toBeVisible({ timeout: 10_000 });

    // Backend type chips should be present
    await expect(page.getByRole('button', { name: 'Local' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Azure Blob' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'AWS S3' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Google Cloud' })).toBeVisible();
  });
});

test.describe('Setup Wizard — accessibility', () => {
  test('setup page is accessible without authentication', async ({ browser }) => {
    // /setup is a public route — verify no redirect to /login
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    // Mock setup as incomplete so we stay on the page
    await page.route('**/api/v1/setup/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ setup_completed: false }),
      }),
    );

    await page.goto('/setup');

    // Should NOT redirect to /login
    await page.waitForTimeout(2_000);
    expect(page.url()).not.toContain('/login');

    // Should show the setup wizard
    await expect(
      page.getByRole('heading', { name: 'Terraform Registry Setup' }),
    ).toBeVisible({ timeout: 10_000 });

    await context.close();
  });
});
