import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Helper: run axe on a page and assert zero critical or serious violations.
 * Logs full node details for any violation found.
 */
async function assertNoA11yViolations(page: import('@playwright/test').Page) {
  // Dismiss consent banner if present (it overlays the page and is tested separately)
  const acceptBtn = page.getByRole('button', { name: 'Accept all' });
  if (await acceptBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await acceptBtn.click();
    await page.waitForTimeout(300);
  }

  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );

  if (violations.length > 0) {
    for (const v of violations) {
      console.warn(`a11y [${v.impact}] ${v.id}: ${v.description}`);
      for (const node of v.nodes) {
        console.warn(`  target: ${JSON.stringify(node.target)}`);
        console.warn(`  html: ${node.html}`);
        console.warn(`  message: ${node.failureSummary}`);
      }
    }
  }

  expect(violations).toEqual([]);
}

/**
 * Helper: run axe and log violations without failing the test.
 * Used for newly-added pages that have pre-existing violations to be
 * fixed incrementally.
 */
async function warnA11yViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );

  if (violations.length > 0) {
    for (const v of violations) {
      console.warn(`a11y [${v.impact}] ${v.id}: ${v.description}`);
      for (const node of v.nodes) {
        console.warn(`  target: ${JSON.stringify(node.target)}`);
        console.warn(`  html: ${node.html}`);
        console.warn(`  message: ${node.failureSummary}`);
      }
    }
    console.warn(`⚠ ${violations.length} a11y violations found — tracked for remediation`);
  }
}

// Pages already enforcing zero violations (baseline)
const enforcedRoutes: Array<{ name: string; path: string }> = [
  { name: 'Home', path: '/' },
  { name: 'Login', path: '/login' },
  { name: 'Modules', path: '/modules' },
  { name: 'Providers', path: '/providers' },
];

// Newly-audited public pages — warn only until violations are fixed
const auditedRoutes: Array<{ name: string; path: string }> = [
  { name: 'Terraform Binaries', path: '/terraform-binaries' },
  { name: 'API Documentation', path: '/api-docs' },
];

test.describe('Accessibility — enforced pages (zero violations)', () => {
  for (const route of enforcedRoutes) {
    test(`${route.name} (${route.path}) has no critical or serious a11y violations`, async ({
      page,
    }) => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      await assertNoA11yViolations(page);
    });
  }
});

test.describe('Accessibility — audited pages (warn only)', () => {
  for (const route of auditedRoutes) {
    test(`${route.name} (${route.path}) a11y audit`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      await warnA11yViolations(page);
    });
  }
});

// Admin routes — warn only (require authenticated session)
const adminRoutes: Array<{ name: string; path: string }> = [
  { name: 'Dashboard', path: '/admin' },
  { name: 'Users', path: '/admin/users' },
  { name: 'Organizations', path: '/admin/organizations' },
  { name: 'Roles', path: '/admin/roles' },
  { name: 'API Keys', path: '/admin/apikeys' },
  { name: 'Module Upload', path: '/admin/upload/module' },
  { name: 'Provider Upload', path: '/admin/upload/provider' },
  { name: 'SCM Providers', path: '/admin/scm-providers' },
  { name: 'Mirrors', path: '/admin/mirrors' },
  { name: 'Terraform Mirror', path: '/admin/terraform-mirror' },
  { name: 'Storage', path: '/admin/storage' },
  { name: 'Approvals', path: '/admin/approvals' },
  { name: 'Mirror Policies', path: '/admin/policies' },
  { name: 'OIDC Settings', path: '/admin/oidc' },
  { name: 'SCIM Provisioning', path: '/admin/scim' },
  { name: 'mTLS', path: '/admin/mtls' },
  { name: 'Audit Logs', path: '/admin/audit-logs' },
  { name: 'Security Scanning', path: '/admin/security-scanning' },
];

test.describe('Accessibility — admin pages (warn only)', () => {
  test.describe.configure({ mode: 'serial' });

  for (const route of adminRoutes) {
    test(`${route.name} (${route.path}) a11y audit`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      await warnA11yViolations(page);
    });
  }
});
