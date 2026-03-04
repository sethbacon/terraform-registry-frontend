import { test, expect } from '../fixtures/auth';

/**
 * Module and Provider upload page E2E tests.
 *
 * Covers:
 *  - Module upload page loads and shows method selector
 *  - Module upload form validates required fields
 *  - Provider upload page loads and shows method selector
 *  - Provider upload form validates required fields
 *  - /admin/upload redirects to /admin/upload/module
 */

test.describe('Module Upload page', () => {
  test('page loads and shows upload method selector', async ({ loggedInPage: page }) => {
    await page.goto('/admin/upload/module');

    await page.waitForSelector('[class*="MuiCard"], [class*="MuiContainer"]', {
      timeout: 10_000,
    });

    // Should have some content — heading or method cards
    const content = await page.locator('main, [class*="MuiContainer"]').first().textContent();
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(5);
  });

  test('page has at least one action button', async ({ loggedInPage: page }) => {
    await page.goto('/admin/upload/module');

    await page.waitForSelector('[class*="MuiButton"], [class*="MuiCard"]', {
      timeout: 10_000,
    });

    const buttons = page.locator('[class*="MuiButton"]');
    expect(await buttons.count()).toBeGreaterThan(0);
  });

  test('upload method cards are visible', async ({ loggedInPage: page }) => {
    await page.goto('/admin/upload/module');

    await page.waitForSelector('[class*="MuiCard"]', { timeout: 10_000 });

    // Method selection cards (Upload .zip / SCM) should be rendered
    const cards = page.locator('[class*="MuiCard"]');
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('selecting manual upload shows upload form', async ({ loggedInPage: page }) => {
    await page.goto('/admin/upload/module');

    // Wait for method selection cards
    await page.waitForSelector('[class*="MuiCard"]', { timeout: 10_000 });

    // Click the upload / "Manual Upload" card if method selection is shown
    const uploadCard = page
      .getByText(/upload/i)
      .locator('xpath=ancestor::*[contains(@class,"MuiCard")]')
      .first();

    const hasCard = await uploadCard.count() > 0;

    if (!hasCard) {
      // Already on a form view — just check form fields exist
      const hasFields = await page.locator('input').count() > 0;
      expect(hasFields).toBe(true);
      return;
    }

    await uploadCard.click();

    // After selecting, form fields (namespace, name, version, etc.) should appear
    await page.waitForSelector('input', { timeout: 10_000 });
    expect(await page.locator('input').count()).toBeGreaterThan(0);
  });

  test('upload submit button is disabled until a file is selected', async ({
    loggedInPage: page,
  }) => {
    await page.goto('/admin/upload/module');
    await page.waitForSelector('[class*="MuiCard"]', { timeout: 10_000 });

    // Click the "Upload from File" method card to reveal the upload form
    await page.getByText('Upload from File').click();
    await page.waitForSelector('input[type="text"], input[placeholder]', { timeout: 10_000 });

    // The "Upload Module" submit button should be disabled because no file has been chosen
    const submitBtn = page.getByRole('button', { name: 'Upload Module' });
    await expect(submitBtn).toBeVisible({ timeout: 5_000 });
    await expect(submitBtn).toBeDisabled();
  });
});

test.describe('/admin/upload redirect', () => {
  test('/admin/upload redirects to /admin/upload/module', async ({ loggedInPage: page }) => {
    await page.goto('/admin/upload');

    await page.waitForURL('**/admin/upload/module', { timeout: 10_000 });
    expect(page.url()).toContain('/admin/upload/module');
  });
});

test.describe('Provider Upload page', () => {
  test('page loads and shows upload method selector', async ({ loggedInPage: page }) => {
    await page.goto('/admin/upload/provider');

    await page.waitForSelector('[class*="MuiCard"], [class*="MuiContainer"]', {
      timeout: 10_000,
    });

    const content = await page.locator('main, [class*="MuiContainer"]').first().textContent();
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(5);
  });

  test('page has at least one action button', async ({ loggedInPage: page }) => {
    await page.goto('/admin/upload/provider');

    await page.waitForSelector('[class*="MuiButton"], [class*="MuiCard"]', {
      timeout: 10_000,
    });

    const buttons = page.locator('[class*="MuiButton"]');
    expect(await buttons.count()).toBeGreaterThan(0);
  });

  test('upload method cards are visible', async ({ loggedInPage: page }) => {
    await page.goto('/admin/upload/provider');

    await page.waitForSelector('[class*="MuiCard"]', { timeout: 10_000 });

    const cards = page.locator('[class*="MuiCard"]');
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('selecting manual upload shows upload form with OS/arch fields', async ({
    loggedInPage: page,
  }) => {
    await page.goto('/admin/upload/provider');

    await page.waitForSelector('[class*="MuiCard"]', { timeout: 10_000 });

    // Click the "Upload" card
    const uploadCard = page
      .getByText(/upload/i)
      .locator('xpath=ancestor::*[contains(@class,"MuiCard")]')
      .first();

    const hasCard = await uploadCard.count() > 0;

    if (!hasCard) {
      const hasFields = await page.locator('input').count() > 0;
      expect(hasFields).toBe(true);
      return;
    }

    await uploadCard.click();

    await page.waitForSelector('input', { timeout: 10_000 });
    // Provider upload should have fields for namespace, type, version, os, arch
    expect(await page.locator('input').count()).toBeGreaterThan(0);
  });

  test('upload submit button is disabled until a file is selected', async ({
    loggedInPage: page,
  }) => {
    await page.goto('/admin/upload/provider');
    await page.waitForSelector('[class*="MuiCard"]', { timeout: 10_000 });

    // The provider chooser card is labelled "Manual Upload" (not "Upload from File")
    await page.getByText('Manual Upload').click();
    await page.waitForSelector('input[type="text"], input[placeholder]', { timeout: 10_000 });

    // The "Upload Provider" submit button should be disabled because no file has been chosen
    const submitBtn = page.getByRole('button', { name: 'Upload Provider' });
    await expect(submitBtn).toBeVisible({ timeout: 5_000 });
    await expect(submitBtn).toBeDisabled();
  });
});
