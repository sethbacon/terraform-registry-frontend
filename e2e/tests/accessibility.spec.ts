import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('home page has no critical a11y violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(v => v.impact === 'critical')).toEqual([]);
  });

  test('login page has no critical a11y violations', async ({ page }) => {
    await page.goto('/login');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(v => v.impact === 'critical')).toEqual([]);
  });

  test('modules page has no critical a11y violations', async ({ page }) => {
    await page.goto('/modules');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(v => v.impact === 'critical')).toEqual([]);
  });

  test('providers page has no critical a11y violations', async ({ page }) => {
    await page.goto('/providers');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(v => v.impact === 'critical')).toEqual([]);
  });

  test('home page has no serious a11y violations', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(v => v.impact === 'serious');
    // Log serious violations with full node details for debugging
    if (serious.length > 0) {
      for (const v of serious) {
        console.warn(`a11y [${v.id}]: ${v.description}`);
        for (const node of v.nodes) {
          console.warn(`  target: ${JSON.stringify(node.target)}`);
          console.warn(`  html: ${node.html}`);
          console.warn(`  message: ${node.failureSummary}`);
        }
      }
    }
    expect(serious).toEqual([]);
  });
});
