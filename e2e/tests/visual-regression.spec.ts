/**
 * Visual regression tests using Playwright screenshot comparison.
 *
 * These tests capture baseline screenshots of key pages and fail if the visual
 * output changes unexpectedly between runs.
 *
 * Baselines are stored in e2e/screenshots/. To update baselines after an
 * intentional UI change, run:
 *   npx playwright test visual-regression.spec.ts --update-snapshots
 *
 * Covers (unauthenticated surfaces):
 *   - Home page
 *   - Login page
 *
 * Covers (authenticated surfaces — requires DEV_MODE=true backend):
 *   - Module list page
 *   - Admin dashboard
 *
 * Configuration:
 *   - maxDiffPixels: 200  — tolerates minor anti-aliasing differences across
 *     platforms and browser versions without spurious failures.
 *   - fullPage: false     — viewport-only screenshots keep baselines stable
 *     across content changes below the fold.
 */

import { test, expect } from '../fixtures/auth';

// ---------------------------------------------------------------------------
// Unauthenticated pages
// ---------------------------------------------------------------------------

test.describe('Visual regression — public pages', () => {
  test('home page', async ({ page }) => {
    await page.goto('/');
    // Wait for any lazy-loaded content to settle.
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('home.png', {
      maxDiffPixels: 200,
      fullPage: false,
    });
  });

  test('login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('login.png', {
      maxDiffPixels: 200,
      fullPage: false,
    });
  });

  test('modules list page (public)', async ({ page }) => {
    await page.goto('/modules');
    await page.waitForLoadState('networkidle');
    // Mask the dynamic module count so minor data changes don't break the snapshot.
    await expect(page).toHaveScreenshot('modules-list.png', {
      maxDiffPixels: 200,
      fullPage: false,
      mask: [page.locator('[data-testid="total-count"]')],
    });
  });

  test('providers list page (public)', async ({ page }) => {
    await page.goto('/providers');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('providers-list.png', {
      maxDiffPixels: 200,
      fullPage: false,
      mask: [page.locator('[data-testid="total-count"]')],
    });
  });
});

// ---------------------------------------------------------------------------
// Authenticated pages (require dev login — DEV_MODE=true)
// ---------------------------------------------------------------------------

test.describe('Visual regression — authenticated pages', () => {
  test('admin dashboard', async ({ loggedInPage: page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    // Mask version chips, timestamps, and dynamic counts that change per run.
    await expect(page).toHaveScreenshot('admin-dashboard.png', {
      maxDiffPixels: 200,
      fullPage: false,
      mask: [
        page.locator('[data-testid="version-chip"]'),
        page.locator('[data-testid="stat-count"]'),
        page.locator('time'),
      ],
    });
  });

  test('module detail page (if modules exist)', async ({ loggedInPage: page }) => {
    await page.goto('/modules');
    await page.waitForLoadState('networkidle');

    // Only run the visual snapshot if at least one module is listed.
    const firstModule = page.locator('[data-testid="module-card"]').first();
    const hasModules = await firstModule.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasModules) {
      test.skip(true, 'No modules in registry — skipping module detail visual regression');
    }

    await firstModule.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('module-detail.png', {
      maxDiffPixels: 200,
      fullPage: false,
      mask: [
        page.locator('[data-testid="published-at"]'),
        page.locator('[data-testid="download-count"]'),
      ],
    });
  });
});
