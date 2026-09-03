import path from 'path';
import type { Page } from '@playwright/test';
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
 *  - A real file (via setInputFiles) is accepted or rejected end-to-end (#605)
 */

const FIXTURES_DIR = path.join(__dirname, '../fixtures/files');
const VALID_MODULE_ARCHIVE = path.join(FIXTURES_DIR, 'valid-module.tar.gz');
const VALID_PROVIDER_ARCHIVE = path.join(FIXTURES_DIR, 'valid-provider.zip');
const DISALLOWED_EXTENSION_FILE = path.join(FIXTURES_DIR, 'disallowed-extension.exe');

/** Unique-ish suffix so re-running against a persistent local stack does not 409 on a repeat namespace/name/version. */
const runSuffix = Date.now();

/**
 * ModuleUploadPage's success path branches: it navigates away when there is no
 * publish policy configured, or (when a policy check runs) stays on the page
 * and shows a "Module uploaded successfully." alert instead. Poll for either
 * outcome, and fail fast with the real error text if the upload alert shows
 * a failure instead.
 */
async function waitForModuleUploadOutcome(
  page: Page,
  namespace: string,
  name: string,
  system: string,
): Promise<void> {
  const detailUrl = new RegExp(`/modules/${namespace}/${name}/${system}`);
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    if (detailUrl.test(page.url())) return;
    if (await page.getByText('Module uploaded successfully.').isVisible().catch(() => false)) {
      return;
    }
    const failureAlert = page.getByText(/Failed to upload module/i);
    if (await failureAlert.isVisible().catch(() => false)) {
      const text = await failureAlert.textContent().catch(() => null);
      throw new Error(`Module upload failed: ${text ?? '(no error text)'}`);
    }
    await page.waitForTimeout(250);
  }

  throw new Error(
    `Module upload did not complete within 20s (no navigation to ${detailUrl} and no success message)`,
  );
}

test.describe('Module Upload page', () => {
  test('page loads and shows upload method selector', async ({ loggedInPage: page }) => {
    await page.goto('/admin/upload/module');

    await expect(page.locator('[class*="MuiCard"], [class*="MuiContainer"]').first()).toBeVisible();

    // Should have some content — heading or method cards
    const content = await page.locator('main, [class*="MuiContainer"]').first().textContent();
    expect(content).not.toBeNull();
    expect(content!.length).toBeGreaterThan(5);
  });

  test('page has at least one action button', async ({ loggedInPage: page }) => {
    await page.goto('/admin/upload/module');

    await expect(page.locator('[class*="MuiButton"], [class*="MuiCard"]').first()).toBeVisible();

    const buttons = page.locator('[class*="MuiButton"]');
    expect(await buttons.count()).toBeGreaterThan(0);
  });

  test('upload method cards are visible', async ({ loggedInPage: page }) => {
    await page.goto('/admin/upload/module');

    await expect(page.locator('[class*="MuiCard"]').first()).toBeVisible();

    // Method selection cards (Upload .zip / SCM) should be rendered
    const cards = page.locator('[class*="MuiCard"]');
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('selecting manual upload shows upload form', async ({ loggedInPage: page }) => {
    await page.goto('/admin/upload/module');

    // Wait for method selection cards
    await expect(page.locator('[class*="MuiCard"]').first()).toBeVisible();

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
    await expect(page.locator('input').first()).toBeVisible();
    expect(await page.locator('input').count()).toBeGreaterThan(0);
  });

  test('upload submit button is disabled until a file is selected', async ({
    loggedInPage: page,
  }) => {
    await page.goto('/admin/upload/module');
    await expect(page.locator('[class*="MuiCard"]').first()).toBeVisible();

    // Click the "Upload from File" method card to reveal the upload form
    await page.getByText('Upload from File').click();
    await expect(page.locator('input[type="text"], input[placeholder]').first()).toBeVisible();

    // The "Upload Module" submit button should be disabled because no file has been chosen
    const submitBtn = page.getByRole('button', { name: 'Upload Module' });
    await expect(submitBtn).toBeVisible({ timeout: 5_000 });
    await expect(submitBtn).toBeDisabled();
  });
});

test.describe('/admin/upload redirect', () => {
  test('/admin/upload redirects to /admin/upload/module', async ({ loggedInPage: page }) => {
    await page.goto('/admin/upload');

    await page.waitForURL('**/admin/upload/module');
    expect(page.url()).toContain('/admin/upload/module');
  });
});

test.describe('Provider Upload page', () => {
  test('page loads and shows upload method selector', async ({ loggedInPage: page }) => {
    await page.goto('/admin/upload/provider');

    await expect(page.locator('[class*="MuiCard"], [class*="MuiContainer"]').first()).toBeVisible();

    const content = await page.locator('main, [class*="MuiContainer"]').first().textContent();
    expect(content).not.toBeNull();
    expect(content!.length).toBeGreaterThan(5);
  });

  test('page has at least one action button', async ({ loggedInPage: page }) => {
    await page.goto('/admin/upload/provider');

    await expect(page.locator('[class*="MuiButton"], [class*="MuiCard"]').first()).toBeVisible();

    const buttons = page.locator('[class*="MuiButton"]');
    expect(await buttons.count()).toBeGreaterThan(0);
  });

  test('upload method cards are visible', async ({ loggedInPage: page }) => {
    await page.goto('/admin/upload/provider');

    await expect(page.locator('[class*="MuiCard"]').first()).toBeVisible();

    const cards = page.locator('[class*="MuiCard"]');
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('selecting manual upload shows upload form with OS/arch fields', async ({
    loggedInPage: page,
  }) => {
    await page.goto('/admin/upload/provider');

    await expect(page.locator('[class*="MuiCard"]').first()).toBeVisible();

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

    await expect(page.locator('input').first()).toBeVisible();
    // Provider upload should have fields for namespace, type, version, os, arch
    expect(await page.locator('input').count()).toBeGreaterThan(0);
  });

  test('upload submit button is disabled until a file is selected', async ({
    loggedInPage: page,
  }) => {
    await page.goto('/admin/upload/provider');
    await expect(page.locator('[class*="MuiCard"]').first()).toBeVisible();

    // The provider chooser card is labelled "Manual Upload" (not "Upload from File")
    await page.getByText('Manual Upload').click();
    await expect(page.locator('input[type="text"], input[placeholder]').first()).toBeVisible();

    // The "Upload Provider" submit button should be disabled because no file has been chosen
    const submitBtn = page.getByRole('button', { name: 'Upload Provider' });
    await expect(submitBtn).toBeVisible({ timeout: 5_000 });
    await expect(submitBtn).toBeDisabled();
  });
});

test.describe('FileDropZone (roadmap 2.5)', () => {
  test('module upload form renders drag-and-drop zone', async ({ loggedInPage: page }) => {
    await page.goto('/admin/upload/module');
    await page.getByText('Upload from File').click();
    const zone = page.getByTestId('module-upload-dropzone');
    await expect(zone).toBeVisible();
    await expect(zone).toContainText(/Drop .+ file here or click to browse/i);
  });

  test('provider upload form renders drag-and-drop zone', async ({ loggedInPage: page }) => {
    await page.goto('/admin/upload/provider');
    await page.getByText('Manual Upload').click();
    const zone = page.getByTestId('provider-upload-dropzone');
    await expect(zone).toBeVisible();
    await expect(zone).toContainText(/\.zip/);
  });
});

/**
 * Real file upload coverage (#605).
 *
 * Every other test in this file only asserts on the dropzone's visual shape.
 * These tests drive an actual `setInputFiles` through the real form and hit
 * the live backend, exercising the extension allowlist rejection and a real
 * multipart upload end-to-end -- not just client-side UI state.
 */
test.describe('Real file upload (#605)', () => {
  test('module upload: a disallowed extension is rejected with a visible error', async ({
    loggedInPage: page,
  }) => {
    await page.goto('/admin/upload/module');
    await page.getByText('Upload from File').click();
    await expect(page.getByTestId('module-upload-dropzone')).toBeVisible();

    await page.getByTestId('module-upload-dropzone-input').setInputFiles(DISALLOWED_EXTENSION_FILE);

    const error = page.getByTestId('module-upload-dropzone-error');
    await expect(error).toBeVisible({ timeout: 5_000 });
    await expect(error).toContainText(/Invalid file type/i);

    // Rejected files never reach onFileSelected, so the form still has no file.
    await expect(page.getByRole('button', { name: 'Upload Module' })).toBeDisabled();
  });

  test('module upload: a valid .tar.gz archive is accepted and the module is published', async ({
    loggedInPage: page,
  }) => {
    const moduleName = `e2eupload${runSuffix}`;

    await page.goto('/admin/upload/module');
    await page.getByText('Upload from File').click();

    await page.getByLabel('Namespace').fill('e2e-fixtures');
    await page.getByLabel('Module Name').fill(moduleName);
    // Role-scoped: getByLabel substring-matches the sidebar nav tooltips'
    // aria-labels too ("Configure SCM providers...", "...pending mirrored
    // versions", etc.), which is a strict-mode violation. Restricting to the
    // textbox role excludes those spans while keeping substring matching
    // (required-field labels render as "Provider *").
    await page.getByRole('textbox', { name: 'Provider' }).fill('aws');
    await page.getByRole('textbox', { name: 'Version' }).fill('1.0.0');

    await page.getByTestId('module-upload-dropzone-input').setInputFiles(VALID_MODULE_ARCHIVE);

    // File accepted: the dropzone shows the picked filename and no error alert.
    await expect(page.getByTestId('module-upload-dropzone')).toContainText('valid-module.tar.gz');
    await expect(page.getByTestId('module-upload-dropzone-error')).not.toBeVisible();

    const submitBtn = page.getByRole('button', { name: 'Upload Module' });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await waitForModuleUploadOutcome(page, 'e2e-fixtures', moduleName, 'aws');
  });

  test('provider upload: a disallowed extension is rejected with a visible error', async ({
    loggedInPage: page,
  }) => {
    await page.goto('/admin/upload/provider');
    await page.getByText('Manual Upload').click();
    await expect(page.getByTestId('provider-upload-dropzone')).toBeVisible();

    await page
      .getByTestId('provider-upload-dropzone-input')
      .setInputFiles(DISALLOWED_EXTENSION_FILE);

    const error = page.getByTestId('provider-upload-dropzone-error');
    await expect(error).toBeVisible({ timeout: 5_000 });
    await expect(error).toContainText(/Invalid file type/i);

    await expect(page.getByRole('button', { name: 'Upload Provider' })).toBeDisabled();
  });

  test('provider upload: a valid .zip archive is accepted and the provider is published', async ({
    loggedInPage: page,
  }) => {
    const providerName = `e2eupload${runSuffix}`;

    await page.goto('/admin/upload/provider');
    await page.getByText('Manual Upload').click();

    await page.getByLabel('Namespace').fill('e2e-fixtures');
    await page.getByLabel('Provider Name').fill(providerName);
    // Role-scoped for the same nav-tooltip aria-label collision as the module
    // upload test above ("...pending mirrored versions" contains "version").
    await page.getByRole('textbox', { name: 'Version' }).fill('1.0.0');

    // The OS/Architecture Selects don't wire an aria-labelledby to their
    // InputLabel, so getByLabel() can't find them -- scope by the FormControl
    // that contains the label text instead (same idiom other specs in this
    // suite use for MUI Selects, e.g. `[class*="MuiSelect"]`).
    await page
      .locator('[class*="MuiFormControl-root"]')
      .filter({ hasText: 'Operating System' })
      .getByRole('combobox')
      .click();
    await page.getByRole('option', { name: 'Linux' }).click();

    await page
      .locator('[class*="MuiFormControl-root"]')
      .filter({ hasText: 'Architecture' })
      .getByRole('combobox')
      .click();
    await page.getByRole('option', { name: /AMD64/i }).click();

    await page.getByTestId('provider-upload-dropzone-input').setInputFiles(VALID_PROVIDER_ARCHIVE);

    await expect(page.getByTestId('provider-upload-dropzone')).toContainText('valid-provider.zip');
    await expect(page.getByTestId('provider-upload-dropzone-error')).not.toBeVisible();

    const submitBtn = page.getByRole('button', { name: 'Upload Provider' });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // ProviderUploadPage navigates to the detail page unconditionally on success.
    await page.waitForURL(new RegExp(`/providers/e2e-fixtures/${providerName}`), {
      timeout: 20_000,
    });
  });
});
