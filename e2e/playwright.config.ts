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
  snapshotDir: './screenshots',
  snapshotPathTemplate: '{snapshotDir}/{arg}{ext}',
  // 60 s per test — covers the full lifecycle including the loggedInPage fixture
  // which performs a complete dev-login round-trip (goto /login → click → waitForURL)
  // before the test body even starts.  30 s was too tight on slower machines.
  timeout: 60_000,
  expect: { timeout: 5_000 },

  /* No retries — failures should be visible immediately */
  retries: 0,

  /* Stop after the first failure so CI feedback is fast */
  maxFailures: 1,

  workers: process.env.CI ? 4 : undefined,

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
    // Pre-set consent preferences so the ConsentBanner overlay does not block
    // pointer events during E2E tests.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: process.env.BASE_URL ?? 'https://localhost:3000',
          localStorage: [
            {
              name: 'terraform-registry-consent',
              value: JSON.stringify({ essential: true, errorReporting: false, performanceReporting: false, analytics: false }),
            },
          ],
        },
      ],
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Firefox and WebKit are included only in CI to keep local test runs fast.
    ...(process.env.CI
      ? [
        {
          name: 'firefox',
          use: { ...devices['Desktop Firefox'] },
          // Firefox runs second in this job, after chromium's full run has
          // already had the docker-compose stack (postgres+backend+frontend)
          // under sustained load, and each worker's cold browser context
          // pays a first-paint cost the warmed-up chromium run does not see.
          // Observed directly: bare `expect(...).toBeVisible()` assertions in
          // test bodies (no local override, so they ran on the 5s global
          // default) intermittently timed out under that load, and a
          // different spec file failed the same way run to run -- the
          // signature of a budget that is occasionally too tight, not a
          // deterministic regression. (devLogin's own waits in
          // fixtures/auth.ts already carry an explicit, larger timeout of
          // their own and so are untouched by this project-level default --
          // that cold-start-sensitive path was bumped separately, for the
          // same underlying reason.) Same reasoning as webkit below; chromium
          // alone keeps the original tight bound.
          expect: { timeout: 15_000 },
        },
        {
          name: 'webkit',
          use: { ...devices['Desktop Safari'] },
          // WebKit is the slowest engine here and runs four workers deep in CI,
          // where a first paint can exceed the 5s global expect timeout on an
          // otherwise correct page. This raises the assertion budget for THIS
          // project only, so chromium keeps the tighter bound and a genuine
          // regression there still shows up as one.
          expect: { timeout: 15_000 },
        },
      ]
      : []),
  ],
});
