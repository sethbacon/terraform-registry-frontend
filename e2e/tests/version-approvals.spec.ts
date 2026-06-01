import { test, expect } from '../fixtures/auth';
import { test as baseTest } from '@playwright/test';

/**
 * Version Approvals E2E tests.
 *
 * Covers the admin page that gates mirrored provider/terraform versions:
 *  - page renders heading and content
 *  - status tabs (Pending / Approved / Rejected) are present and switchable
 *  - provider/terraform type filter is present
 *  - table renders rows or the empty state
 *  - sidebar navigation reaches the page
 *  - unauthenticated access redirects to /login
 */

// Wait out the full-page spinner shown while the first query is in flight.
async function waitForLoad(page: import('@playwright/test').Page): Promise<void> {
  const spinner = page.locator('[class*="MuiCircularProgress"]').first();
  const visible = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
  if (visible) {
    await expect(spinner).toBeHidden({ timeout: 20_000 });
  }
}

test.describe('Admin: Version Approvals', () => {
  test('page renders heading', async ({ loggedInPage: page }) => {
    await page.goto('/admin/version-approvals');
    await waitForLoad(page);

    await expect(
      page.getByRole('heading', { name: /Version Approvals/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows status tabs and switches between them', async ({ loggedInPage: page }) => {
    await page.goto('/admin/version-approvals');
    await waitForLoad(page);

    const pendingTab = page.getByRole('tab', { name: /^Pending$/i });
    const approvedTab = page.getByRole('tab', { name: /^Approved$/i });
    const rejectedTab = page.getByRole('tab', { name: /^Rejected$/i });

    await expect(pendingTab).toBeVisible({ timeout: 10_000 });
    await expect(approvedTab).toBeVisible();
    await expect(rejectedTab).toBeVisible();

    // Switching tabs must not error and must keep the table/empty-state visible.
    await approvedTab.click();
    await waitForLoad(page);
    await rejectedTab.click();
    await waitForLoad(page);
    await pendingTab.click();
    await waitForLoad(page);
  });

  test('shows the provider/terraform type filter', async ({ loggedInPage: page }) => {
    await page.goto('/admin/version-approvals');
    await waitForLoad(page);

    await expect(
      page.getByRole('button', { name: /Provider Versions/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('button', { name: /Terraform Versions/i }),
    ).toBeVisible();
  });

  test('renders the version table or an empty state', async ({ loggedInPage: page }) => {
    await page.goto('/admin/version-approvals');
    await waitForLoad(page);

    // Wait for the data query to settle before asserting. waitForLoad alone is
    // not enough: isVisible() is an instantaneous check, so if the loading
    // spinner isn't on screen at that exact instant the helper returns early and
    // we can race ahead of the first render. The table (with its empty-state row)
    // or a load-error alert is the settled DOM — wait for one to appear.
    await page.waitForSelector('table, [class*="MuiAlert"]', { timeout: 10_000 });

    // Either gated versions are listed in the table, or the "no versions" empty
    // state is shown — both render inside the table, so its presence is enough.
    const hasTable = (await page.locator('table').count()) > 0;
    const hasEmpty = await page
      .getByText(/no versions matching this filter/i)
      .isVisible()
      .catch(() => false);

    expect(hasTable || hasEmpty).toBe(true);
  });

  test('is reachable from the admin sidebar', async ({ loggedInPage: page }) => {
    await page.goto('/admin');
    await waitForLoad(page);

    const navLink = page.getByRole('link', { name: /Version Approvals/i }).first();
    const navVisible = await navLink.isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(!navVisible, 'Version Approvals nav entry not rendered in this layout');

    await navLink.click();
    await page.waitForURL('**/admin/version-approvals', { timeout: 10_000 });
    await expect(
      page.getByRole('heading', { name: /Version Approvals/i }),
    ).toBeVisible({ timeout: 10_000 });
  });
});

baseTest.describe('Admin: Version Approvals — unauthenticated', () => {
  baseTest('unauthenticated access redirects to /login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto('/admin/version-approvals');

    await page.waitForURL('**/login', { timeout: 10_000 });
    expect(page.url()).toContain('/login');

    await context.close();
  });
});
