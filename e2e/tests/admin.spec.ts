import { type Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth';

/**
 * Admin panel E2E tests.
 *
 * Covers:
 *  - Dashboard page loads with stat cards
 *  - Users page loads and shows a table
 *  - Organizations page loads
 *  - Roles page loads with role accordion list
 *  - API Keys page loads
 *  - SCM Providers page loads
 *  - Provider Mirrors page loads
 *  - Storage page loads
 *  - Unauthenticated access to admin routes redirects to /login
 */

test.describe('Admin: Users', () => {
  test('users page loads with a table', async ({ loggedInPage: page }) => {
    await page.goto('/admin/users');

    // Wait for the page content to load
    await page.waitForSelector('table, [class*="MuiTable"], h6:has-text("No users")', {
      timeout: 10_000,
    });

    const hasTable = await page.locator('table, [class*="MuiTable"]').count() > 0;
    const hasEmptyState = await page.getByText(/no users/i).isVisible().catch(() => false);

    // Page should show either a users table or a "no users" empty state
    expect(hasTable || hasEmptyState).toBe(true);
  });

  test('users page has an "Add User" or create button', async ({ loggedInPage: page }) => {
    await page.goto('/admin/users');

    await page.waitForSelector('[class*="MuiButton"], [class*="MuiIconButton"]', {
      timeout: 10_000,
    });

    // At least one action button should be present (Add, Create, etc.)
    const actionBtns = page.locator('[class*="MuiButton"], [class*="MuiIconButton"]');
    expect(await actionBtns.count()).toBeGreaterThan(0);
  });
});

test.describe('Admin: Organizations', () => {
  test('organizations page loads', async ({ loggedInPage: page }) => {
    await page.goto('/admin/organizations');

    await page.waitForSelector(
      'table, [class*="MuiTable"], h6:has-text("No organizations"), [class*="MuiCircularProgress"]',
      { timeout: 10_000 }
    );

    const loadingSpinner = page.locator('[class*="MuiCircularProgress"]').first();
    if (await loadingSpinner.isVisible()) {
      await expect(loadingSpinner).toBeHidden({ timeout: 15_000 });
    }

    const hasTable = await page.locator('table, [class*="MuiTable"]').count() > 0;
    const hasEmptyState = await page
      .getByText(/no organizations/i)
      .isVisible()
      .catch(() => false);

    // Page should show either an organizations table or a "no organizations" empty state
    expect(hasTable || hasEmptyState).toBe(true);
  });
});

test.describe('Admin: API Keys', () => {
  test('api keys page loads', async ({ loggedInPage: page }) => {
    await page.goto('/admin/apikeys');

    // Wait directly for settled content — either a table (keys exist) or the
    // empty-state text (no keys yet).  Using .or() avoids the race where
    // MuiPaper appears immediately (while the API call is still in-flight)
    // and the old spinner-check dance misses the loading window on fast backends.
    const table = page.locator('table, [class*="MuiTable"]');
    const emptyState = page.getByText('No API keys found');
    await expect(table.or(emptyState).first()).toBeVisible({ timeout: 15_000 });

    const hasTable = await table.count() > 0;
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    // Page should show either an API keys table or a "No API keys found" empty state
    expect(hasTable || hasEmptyState).toBe(true);
  });

  test('api keys page has a create button', async ({ loggedInPage: page }) => {
    await page.goto('/admin/apikeys');

    await page.waitForSelector('[class*="MuiButton"], [class*="MuiIconButton"]', {
      timeout: 10_000,
    });

    const actionBtns = page.locator('[class*="MuiButton"], [class*="MuiIconButton"]');
    expect(await actionBtns.count()).toBeGreaterThan(0);
  });
});

test.describe('Admin: Provider Mirrors', () => {
  test('mirrors page loads', async ({ loggedInPage: page }) => {
    await page.goto('/admin/mirrors');

    // MirrorsPage renders a full-page CircularProgress (not inside a MuiCard) while
    // loading, then swaps to content.  Wait for the spinner to appear then go away,
    // falling back to a network-idle check if the spinner renders too quickly.
    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerAppeared = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerAppeared) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    } else {
      // Already finished loading — wait for network to settle
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    }

    // After loading the page renders a heading "Mirroring — Provider Config"
    await expect(
      page.getByRole('heading', { name: /Provider Config/i })
    ).toBeVisible({ timeout: 10_000 });

    // Cards (if mirrors exist) or an empty-state message should be present
    const hasCards = (await page.locator('[class*="MuiCard"]').count()) > 0;
    const hasEmptyText = await page
      .getByText(/no mirror|no configuration|add.*mirror/i)
      .isVisible()
      .catch(() => false);
    // Page may show mirror config cards or an empty-state message depending on test data
    expect(hasCards || hasEmptyText).toBe(true);
  });

  test('page has labelled Refresh and Add Mirror buttons', async ({ loggedInPage: page }) => {
    await page.goto('/admin/mirrors');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerAppeared = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerAppeared) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    } else {
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    }

    // PR 1 fix: Refresh should be a labelled button
    await expect(
      page.getByRole('button', { name: /^Refresh$/i })
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByRole('button', { name: /Add Mirror/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('mirror cards use two-group CardActions layout with View Details button', async ({ loggedInPage: page }) => {
    await page.goto('/admin/mirrors');

    const spinner = page.locator('[class*="MuiCircularProgress"]').first();
    const spinnerAppeared = await spinner.isVisible({ timeout: 5_000 }).catch(() => false);
    if (spinnerAppeared) {
      await expect(spinner).toBeHidden({ timeout: 20_000 });
    } else {
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    }

    // Check for CardActions specifically — the empty state also renders a <Card> without actions
    const hasMirrorCards = (await page.locator('[class*="MuiCardActions"]').count()) > 0;
    if (!hasMirrorCards) {
      // No mirror configs in this environment — nothing to assert on cards
      return;
    }

    // PR 3 fix: CardActions should have a "View Details" text button
    // Note: the button has tooltip title "View status and current sync" so we match by visible text
    await expect(
      page.locator('[class*="MuiCardActions"] button', { hasText: /View Details/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Admin: Unauthenticated access', () => {
  test('accessing /admin/users without auth redirects to /login', async ({ browser }) => {
    // Fresh browser context — no stored auth state
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto('/admin/users');

    // React Router ProtectedRoute redirects client-side to /login
    await page.waitForURL('**/login', { timeout: 10_000 });
    expect(page.url()).toContain('/login');

    await context.close();
  });
});

test.describe('Admin: Dashboard', () => {
  test('dashboard page loads with stat cards', async ({ loggedInPage: page }) => {
    await page.goto('/admin');

    // Wait for loading to finish
    await page.waitForSelector(
      '[class*="MuiPaper"], [class*="MuiCard"], [class*="MuiCircularProgress"]',
      { timeout: 10_000 }
    );

    const loadingSpinner = page.locator('[class*="MuiCircularProgress"]').first();
    if (await loadingSpinner.isVisible()) {
      await expect(loadingSpinner).toBeHidden({ timeout: 15_000 });
    }

    // Stat cards or content should be present
    const content = await page.locator('main, [class*="MuiContainer"]').first().textContent();
    expect(content).not.toBeNull();
    expect(content!.length).toBeGreaterThan(5);
  });

  test('dashboard page shows at least one stat card', async ({ loggedInPage: page }) => {
    await page.goto('/admin');

    // Wait for loading to finish
    const loadingSpinner = page.locator('[class*="MuiCircularProgress"]').first();
    if (await loadingSpinner.isVisible()) {
      await expect(loadingSpinner).toBeHidden({ timeout: 15_000 });
    }

    await page.waitForSelector('[class*="MuiPaper"], [class*="MuiCard"]', { timeout: 10_000 });

    const cards = page.locator('[class*="MuiPaper"], [class*="MuiCard"]');
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('dashboard quick action buttons are present', async ({ loggedInPage: page }) => {
    await page.goto('/admin');

    const loadingSpinner = page.locator('[class*="MuiCircularProgress"]').first();
    if (await loadingSpinner.isVisible()) {
      await expect(loadingSpinner).toBeHidden({ timeout: 15_000 });
    }

    await page.waitForSelector('[class*="MuiButton"], [class*="MuiIconButton"]', {
      timeout: 10_000,
    });

    const actionBtns = page.locator('[class*="MuiButton"]');
    expect(await actionBtns.count()).toBeGreaterThan(0);
  });
});

test.describe('Admin: Roles', () => {
  test('roles page loads', async ({ loggedInPage: page }) => {
    await page.goto('/admin/roles');

    await page.waitForSelector(
      '[class*="MuiAccordion"], [class*="MuiCircularProgress"], [class*="MuiAlert"], table',
      { timeout: 10_000 }
    );

    const loadingSpinner = page.locator('[class*="MuiCircularProgress"]').first();
    if (await loadingSpinner.isVisible()) {
      await expect(loadingSpinner).toBeHidden({ timeout: 15_000 });
    }

    const content = await page.locator('main, [class*="MuiContainer"]').first().textContent();
    expect(content).not.toBeNull();
    expect(content!.length).toBeGreaterThan(5);
  });

  test('roles page shows role items or empty state', async ({ loggedInPage: page }) => {
    await page.goto('/admin/roles');

    const loadingSpinner = page.locator('[class*="MuiCircularProgress"]').first();
    if (await loadingSpinner.isVisible()) {
      await expect(loadingSpinner).toBeHidden({ timeout: 20_000 });
    }

    await page.waitForSelector(
      '[class*="MuiAccordion"], table, [class*="MuiAlert"]',
      { timeout: 15_000 }
    );

    const hasAccordion = (await page.locator('[class*="MuiAccordion"]').count()) > 0;
    const hasTable = (await page.locator('table').count()) > 0;
    const hasEmptyState = await page.getByText(/no roles/i).isVisible().catch(() => false);

    // Page should show role items (accordion or table) or a "no roles" empty state
    expect(hasAccordion || hasTable || hasEmptyState).toBe(true);
  });
});

test.describe('Admin: SCM Providers', () => {
  test('SCM providers page loads', async ({ loggedInPage: page }) => {
    await page.goto('/admin/scm-providers');

    await page.waitForSelector(
      '[class*="MuiCard"], [class*="MuiCircularProgress"], [class*="MuiAlert"]',
      { timeout: 10_000 }
    );

    const loadingSpinner = page.locator('[class*="MuiCircularProgress"]').first();
    if (await loadingSpinner.isVisible()) {
      await expect(loadingSpinner).toBeHidden({ timeout: 15_000 });
    }

    const content = await page.locator('main, [class*="MuiContainer"]').first().textContent();
    expect(content).not.toBeNull();
    expect(content!.length).toBeGreaterThan(5);
  });

  test('SCM providers page has a create/add button', async ({ loggedInPage: page }) => {
    await page.goto('/admin/scm-providers');

    const loadingSpinner = page.locator('[class*="MuiCircularProgress"]').first();
    if (await loadingSpinner.isVisible()) {
      await expect(loadingSpinner).toBeHidden({ timeout: 15_000 });
    }

    await page.waitForSelector('[class*="MuiButton"], [class*="MuiIconButton"]', {
      timeout: 10_000,
    });

    // An add / create button should exist on this page
    const actionBtns = page.locator('[class*="MuiButton"], [class*="MuiIconButton"]');
    expect(await actionBtns.count()).toBeGreaterThan(0);
  });

  test('SCM providers page shows cards or empty state', async ({ loggedInPage: page }) => {
    await page.goto('/admin/scm-providers');

    const loadingSpinner = page.locator('[class*="MuiCircularProgress"]').first();
    if (await loadingSpinner.isVisible()) {
      await expect(loadingSpinner).toBeHidden({ timeout: 15_000 });
    }

    await page.waitForSelector('[class*="MuiCard"], [class*="MuiAlert"]', {
      timeout: 10_000,
    });

    const hasCards = (await page.locator('[class*="MuiCard"]').count()) > 0;
    const hasEmptyState = await page
      .getByText(/no scm providers|no providers/i)
      .isVisible()
      .catch(() => false);

    // Page should show SCM provider cards or an empty-state message
    expect(hasCards || hasEmptyState).toBe(true);
  });
});

test.describe('Admin: Sidebar Navigation', () => {
  // Helper: expand the MIRRORING nav group by clicking its header if collapsed
  async function ensureMirroringExpanded(page: Page) {
    // If Approvals link is already visible, nothing to do
    const link = page.locator('a', { hasText: /^Approvals$/ });
    const isVisible = await link.isVisible({ timeout: 2_000 }).catch(() => false);
    if (isVisible) return;
    // Click the MIRRORING group header to expand it
    const header = page.locator('[class*="MuiListItemButton"]', { hasText: /^MIRRORING$/i });
    if (await header.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await header.click();
      await page.waitForTimeout(300); // allow collapse animation
    }
  }

  test('sidebar has a link to Approvals', async ({ loggedInPage: page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await ensureMirroringExpanded(page);

    // Sidebar nav link exists and is reachable
    await expect(page.locator('a', { hasText: /^Approvals$/ })).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar Approvals link navigates to /admin/approvals', async ({ loggedInPage: page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await ensureMirroringExpanded(page);

    await page.locator('a', { hasText: /^Approvals$/ }).click();
    await page.waitForURL('**/admin/approvals', { timeout: 10_000 });
    expect(page.url()).toContain('/admin/approvals');
  });

  test('sidebar has a link to Mirror Policies', async ({ loggedInPage: page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await ensureMirroringExpanded(page);

    await expect(page.locator('a', { hasText: /^Mirror Policies$/ })).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar Mirror Policies link navigates to /admin/policies', async ({ loggedInPage: page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await ensureMirroringExpanded(page);

    await page.locator('a', { hasText: /^Mirror Policies$/ }).click();
    await page.waitForURL('**/admin/policies', { timeout: 10_000 });
    expect(page.url()).toContain('/admin/policies');
  });
});

test.describe('Admin: Storage', () => {
  test('storage page loads', async ({ loggedInPage: page }) => {
    await page.goto('/admin/storage');

    const stepper = page.locator('[class*="MuiStepper"]');
    const card = page.locator('[class*="MuiCard"]');
    const alert = page.locator('[class*="MuiAlert"]');
    await expect(stepper.or(card).or(alert).first()).toBeVisible({ timeout: 15_000 });

    const content = await page.locator('main, [class*="MuiContainer"]').first().textContent();
    expect(content).not.toBeNull();
    expect(content!.length).toBeGreaterThan(5);
  });

  test('storage page shows setup wizard, configuration, or configured alert', async ({ loggedInPage: page }) => {
    await page.goto('/admin/storage');

    // Three possible settled states:
    // 1. First-time setup wizard (MuiStepper)
    // 2. Storage configured and showing config cards (MuiCard)
    // 3. Storage already configured — shows warning alert only (MuiAlert, no Card/Stepper)
    const stepper = page.locator('[class*="MuiStepper"]');
    const cards = page.locator('[class*="MuiCard"]');
    const alert = page.locator('[class*="MuiAlert"]');
    await expect(stepper.or(cards).or(alert).first()).toBeVisible({ timeout: 15_000 });

    const hasStepper = (await stepper.count()) > 0;
    const hasCards = (await cards.count()) > 0;
    const hasAlert = (await alert.count()) > 0;

    // Page should show setup wizard (stepper), config cards, or a configured alert
    expect(hasStepper || hasCards || hasAlert).toBe(true);
  });
});
