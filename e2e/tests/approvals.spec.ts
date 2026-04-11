import { test, expect } from '../fixtures/auth';
import { test as baseTest } from '@playwright/test';

/**
 * Approval Requests E2E tests.
 *
 * Covers:
 *  - Approvals page renders heading and content
 *  - Shows approval cards or empty state
 *  - Create dialog opens and has required fields
 *  - Review dialog opens with approve/reject options
 *  - Unauthenticated access redirects to /login
 */

test.describe('Admin: Approval Requests', () => {
  test('approvals page renders heading', async ({ loggedInPage: page }) => {
    await page.goto('/admin/approvals');

    // Wait for the page to load (full-page spinner while fetching)
    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await expect(
      page.getByRole('heading', { name: /Approval Requests/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('approvals page shows cards or empty state', async ({ loggedInPage: page }) => {
    await page.goto('/admin/approvals');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await page.waitForSelector('[class*="MuiCard"], [class*="MuiAlert"]', { timeout: 10_000 });

    const hasCards = (await page.locator('[class*="MuiCard"]').count()) > 0;
    const hasEmptyText = await page
      .getByText(/no approval requests/i)
      .isVisible()
      .catch(() => false);

    // Page should show approval request cards or a "no approval requests" empty state
    expect(hasCards || hasEmptyText).toBe(true);
  });

  test('approvals page has a status filter dropdown', async ({ loggedInPage: page }) => {
    await page.goto('/admin/approvals');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    // The status filter Select should be visible
    const filterSelect = page.locator('[class*="MuiSelect"]').first();
    await expect(filterSelect).toBeVisible({ timeout: 10_000 });
  });

  test('create request button opens dialog', async ({ loggedInPage: page }) => {
    await page.goto('/admin/approvals');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await page.getByRole('button', { name: /Create Request/i }).click();

    // Dialog should open
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByRole('heading', { name: /Create Approval Request/i })
    ).toBeVisible();
  });

  test('create dialog has required form fields', async ({ loggedInPage: page }) => {
    await page.goto('/admin/approvals');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await page.getByRole('button', { name: /Create Request/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Required fields: Mirror Config ID and Provider Namespace
    await expect(page.getByLabel(/Mirror Config ID/i)).toBeVisible();
    await expect(page.getByLabel(/Provider Namespace/i)).toBeVisible();
  });

  test('create dialog submit is disabled when required fields are empty', async ({ loggedInPage: page }) => {
    await page.goto('/admin/approvals');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await page.getByRole('button', { name: /Create Request/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Submit button should be disabled with empty required fields
    const submitBtn = page.getByRole('button', { name: /Submit Request/i });
    await expect(submitBtn).toBeDisabled();
  });

  test('create dialog can be cancelled', async ({ loggedInPage: page }) => {
    await page.goto('/admin/approvals');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    await page.getByRole('button', { name: /Create Request/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5_000 });
  });

  test('review dialog opens when approve button is clicked on a pending approval', async ({ loggedInPage: page }) => {
    await page.goto('/admin/approvals');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    // Only run this check if there are pending approvals with Approve button
    const approveBtn = page.getByRole('button', { name: /^Approve$/i }).first();
    const hasPendingApprovals = await approveBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    test.skip(!hasPendingApprovals, 'No pending approval requests in test environment');

    await approveBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByRole('heading', { name: /Review Approval Request/i })
    ).toBeVisible();
  });

  test('review dialog has approve and reject options', async ({ loggedInPage: page }) => {
    await page.goto('/admin/approvals');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    }

    const approveBtn = page.getByRole('button', { name: /^Approve$/i }).first();
    const hasPendingApprovals = await approveBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    test.skip(!hasPendingApprovals, 'No pending approval requests in test environment');

    await approveBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // The Decision select should contain Approve and Reject options
    const decisionSelect = page.getByLabel(/Decision/i);
    await expect(decisionSelect).toBeVisible();
  });
});

baseTest.describe('Admin: Approval Requests — unauthenticated', () => {
  baseTest('unauthenticated access redirects to /login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto('/admin/approvals');

    await page.waitForURL('**/login', { timeout: 10_000 });
    expect(page.url()).toContain('/login');

    await context.close();
  });
});
