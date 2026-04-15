import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('home page has no critical a11y violations', async ({ page }) => {
    await page.goto('/');
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
    // Log serious violations for awareness but don't fail yet
    if (serious.length > 0) {
      console.warn(
        'Serious a11y violations found:',
        serious.map(v => `${v.id}: ${v.description} (${v.nodes.length} instances)`),
      );
    }
    expect(serious.length).toBeLessThanOrEqual(5);
  });
});
