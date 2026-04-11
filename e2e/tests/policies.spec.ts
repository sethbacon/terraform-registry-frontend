import { test, expect } from '../fixtures/auth';
import { test as baseTest } from '@playwright/test';

/**
 * Mirror Policies E2E tests.
 *
 * Covers:
 *  - Policies page renders heading and content
 *  - Shows policy cards or empty state
 *  - Create policy dialog opens with form fields
 *  - Form submit is disabled when required fields are empty
 *  - Delete confirmation dialog opens
 *  - Evaluate dialog opens
 *  - Unauthenticated access redirects to /login
 */

test.describe('Admin: Mirror Policies', () => {
  test('policies page renders heading', async ({ loggedInPage: page }) => {
    await page.goto('/admin/policies');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await expect(
      page.getByRole('heading', { name: /Mirror Policies/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('policies page shows cards or empty state', async ({ loggedInPage: page }) => {
    await page.goto('/admin/policies');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await page.waitForSelector('[class*="MuiCard"], [class*="MuiAlert"]', { timeout: 10_000 });

    const hasCards = (await page.locator('[class*="MuiCard"]').count()) > 0;
    const hasEmptyText = await page
      .getByText(/no mirror policies/i)
      .isVisible()
      .catch(() => false);

    // Page should show policy cards or a "no mirror policies" empty state
    expect(hasCards || hasEmptyText).toBe(true);
  });

  test('create policy button opens dialog', async ({ loggedInPage: page }) => {
    await page.goto('/admin/policies');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await page.getByRole('button', { name: /Create Policy/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByRole('heading', { name: /Create Mirror Policy/i })
    ).toBeVisible();
  });

  test('create dialog has required form fields', async ({ loggedInPage: page }) => {
    await page.goto('/admin/policies');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await page.getByRole('button', { name: /Create Policy/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Required: Name (textbox) and Policy Type (MUI Select)
    await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toBeVisible();
    // MUI Select renders as a div with role="button" — check the dialog contains the select element
    await expect(
      page.locator('[role="dialog"] [class*="MuiSelect"]').first()
    ).toBeVisible();
  });

  test('create dialog submit is disabled when name is empty', async ({ loggedInPage: page }) => {
    await page.goto('/admin/policies');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await page.getByRole('button', { name: /Create Policy/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    const submitBtn = page.getByRole('button', { name: /^Create$/i });
    await expect(submitBtn).toBeDisabled();
  });

  test('create dialog can be cancelled', async ({ loggedInPage: page }) => {
    await page.goto('/admin/policies');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await page.getByRole('button', { name: /Create Policy/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5_000 });
  });

  test('delete button opens confirmation dialog', async ({ loggedInPage: page }) => {
    await page.goto('/admin/policies');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    // Only run if there are policies to delete
    const deleteBtn = page.locator('[class*="MuiIconButton"]').filter({ has: page.locator('[data-testid="DeleteIcon"]') }).first();
    const hasPolicies = await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    test.skip(!hasPolicies, 'No policies in test environment — skipping delete test');

    await deleteBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByRole('heading', { name: /Confirm Delete/i })
    ).toBeVisible();

    // Cancel the delete
    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5_000 });
  });

  test('evaluate button opens evaluate dialog', async ({ loggedInPage: page }) => {
    await page.goto('/admin/policies');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await page.getByRole('button', { name: /Evaluate/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByRole('heading', { name: /Evaluate Policy/i })
    ).toBeVisible();
  });

  test('evaluate dialog has registry, namespace, and provider fields', async ({ loggedInPage: page }) => {
    await page.goto('/admin/policies');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await page.getByRole('button', { name: /Evaluate/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    await expect(dialog.getByLabel(/Registry/i)).toBeVisible();
    await expect(dialog.getByLabel(/Namespace/i)).toBeVisible();
    await expect(dialog.getByLabel(/Provider/i)).toBeVisible();
  });

  test('evaluate submit is disabled when fields are empty', async ({ loggedInPage: page }) => {
    await page.goto('/admin/policies');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await page.getByRole('button', { name: /Evaluate/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    const evaluateBtn = page.getByRole('button', { name: /^Evaluate$/i });
    await expect(evaluateBtn).toBeDisabled();
  });
});

baseTest.describe('Admin: Mirror Policies — unauthenticated', () => {
  baseTest('unauthenticated access redirects to /login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto('/admin/policies');

    await page.waitForURL('**/login', { timeout: 10_000 });
    expect(page.url()).toContain('/login');

    await context.close();
  });
});
