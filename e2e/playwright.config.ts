import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Terraform Registry E2E tests.
 *
 * Prerequisites (docker-compose):
 *   - Frontend running on https://localhost (port 443, self-signed TLS)
 *   - Backend proxied through nginx on the same host
 *   - Backend started with DEV_MODE=true for dev login to work
 *
 * Prerequisites (local dev):
 *   - Frontend: npm run dev  →  http://localhost:3000
 *   - Backend:  go run ./cmd/server  →  http://localhost:8080
 *   - Set BASE_URL=http://localhost:3000 for local dev
 *
 * Run tests:
 *   npx playwright install chromium
 *   npx playwright test
 *   npx playwright show-report
 */
export default defineConfig({
  testDir: './tests',
  // 60 s per test — covers the full lifecycle including the loggedInPage fixture
  // which performs a complete dev-login round-trip (goto /login → click → waitForURL)
  // before the test body even starts.  30 s was too tight on slower machines.
  timeout: 60_000,
  expect: { timeout: 5_000 },

  /* No retries — failures should be visible immediately */
  retries: 0,

  /* One worker on CI to avoid port conflicts */
  workers: process.env.CI ? 1 : undefined,

  reporter: [['html'], ['list']],

  use: {
    baseURL: process.env.BASE_URL ?? 'https://localhost:3000',
    /* Accept self-signed certificates used in the docker-compose deployment */
    ignoreHTTPSErrors: true,
    // Collect full Playwright trace for every test run so network + console
    // events are recorded for debugging failing tests.
    trace: 'on',
    // Record video too (useful when diagnosing UI hangs). Artifacts are
    // written to Playwright's default output directory under playwright-report.
    video: 'on',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
