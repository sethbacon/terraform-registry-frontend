import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Helper: run axe on a page and assert zero critical or serious violations.
 * Logs full node details for any violation found.
 */
async function assertNoA11yViolations(page: import('@playwright/test').Page) {
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

// All public routes that can be tested without authentication
const publicRoutes: Array<{ name: string; path: string }> = [
  { name: 'Home', path: '/' },
  { name: 'Login', path: '/login' },
  { name: 'Modules', path: '/modules' },
  { name: 'Providers', path: '/providers' },
  { name: 'Terraform Binaries', path: '/terraform-binaries' },
  { name: 'API Documentation', path: '/api-docs' },
];

test.describe('Accessibility — public pages', () => {
  for (const route of publicRoutes) {
    test(`${route.name} (${route.path}) has no critical or serious a11y violations`, async ({
      page,
    }) => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      await assertNoA11yViolations(page);
    });
  }
});

// Admin routes tested with authenticated session (requires login fixture)
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

test.describe('Accessibility — admin pages', () => {
  // These tests require a logged-in session. The storageState fixture
  // should be configured in playwright.config.ts to supply an auth cookie.
  test.describe.configure({ mode: 'serial' });

  for (const route of adminRoutes) {
    test(`${route.name} (${route.path}) has no critical or serious a11y violations`, async ({
      page,
    }) => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      await assertNoA11yViolations(page);
    });
  }
});
