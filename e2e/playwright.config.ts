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
  // 10 s, raised from 5 s when the 119 hand-written `timeout: 10_000` overrides
  // came out of the spec files (#883). Those overrides WON over every
  // project-level `expect.timeout` below -- an explicit per-call timeout always
  // does -- which is why raising firefox to 15 s in #876 changed nothing for
  // them and a Firefox card-render still blew a 10 s budget on the v2.27.0 tag
  // run. 10 s here is deliberately the same number those call sites used, so
  // dropping them is not also a silent tightening on chromium; firefox and
  // webkit now genuinely get more, because there is nothing left overriding
  // them. A site that needs longer than its project's budget still says so
  // explicitly (the surviving 15/20/30 s waits on swagger-ui, the mirror admin
  // poll and similar) -- what is gone is the layer that pinned every ORDINARY
  // wait to one hard-coded number.
  expect: { timeout: 10_000 },

  // Set here, not via the CI step's CLI flags: a `--retries=N` CLI flag
  // overrides EVERY project's own `retries` setting unconditionally,
  // including a project that sets its own (verified directly -- a project
  // configured for 2 retries got exactly 1 when the CLI passed
  // --retries=1, and correctly got 2 once the CLI flag was removed and the
  // count came from config alone). 1 here matches what the CI step's now-
  // removed --retries=1 gave every project; firefox and webkit override it
  // below, for the same environmental-flakiness reasoning their
  // expect.timeout override exists for.
  retries: 1,

  /* Stop after the first failure so CI feedback is fast */
  maxFailures: 1,

  workers: process.env.CI ? 4 : undefined,

  reporter: [['html'], ['list']],

  use: {
    baseURL: process.env.BASE_URL ?? 'https://localhost:3000',
    /* Accept self-signed certificates used in the docker-compose deployment */
    ignoreHTTPSErrors: true,
    // The navigation counterpart to `expect.timeout` above, and the reason the
    // 32 `page.waitForURL(..., { timeout: 10_000 })` overrides could be dropped
    // with the rest (#883): waitForURL is not an assertion, so it never read
    // `expect.timeout` and had no config-owned budget to fall back on at all.
    // 30 s, not 10 s, because the failure being fixed is a slow runner rather
    // than a wrong URL -- a wrong URL is wrong immediately and stays wrong for
    // the whole budget either way.
    //
    // Deliberate second effect: this also bounds `page.goto`, which until now
    // was limited only by the 60 s per-test timeout. That is a tightening, and
    // an intended one -- a navigation to the local compose stack that has not
    // finished in 30 s is not going to, and failing on the goto names the step
    // that hung instead of reporting a whole-test timeout with no culprit.
    navigationTimeout: 30_000,
    // Tracing and video are OFF, and that is a deliberate trade against this
    // suite's failure mode rather than a saving for its own sake.
    //
    // Both were 'on', so every test in every project recorded a full trace and
    // a video whether it passed or not. Playwright's own CI guidance calls
    // always-on tracing "performance heavy" -- it instruments the page and
    // writes to disk continuously -- and this suite's failures are TIMING
    // failures on a loaded runner: the v2.27.0 tag run died on a Firefox render
    // that did not finish inside its budget (#883). Spending runner capacity on
    // recording every passing test, to diagnose the rare failing one, competes
    // with the thing that is already short.
    //
    // What this costs: a failing test no longer ships a trace or a video. It
    // still ships the screenshot below, the error and stack, and the HTML
    // report, which is what named the culprit on v2.27.0.
    //
    // If a failure ever needs a trace again, the middle setting is one word --
    // `trace: 'on-first-retry'` records only the retry of a test that already
    // failed, so the passing path stays uninstrumented. Prefer that to going
    // back to 'on'.
    trace: 'off',
    video: 'off',
    // Kept: this one only fires on a failing test, so it costs nothing on the
    // passing path and is the cheapest artefact that still shows the page.
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
          //
          // 20 s, raised from 15 s in #883. 15 s was never the budget the
          // ordinary waits in the specs actually ran on: each carried its own
          // `timeout: 10_000`, and an explicit per-call timeout beats the
          // project default, so this line governed only the handful of waits
          // that had no override. With those overrides gone it now governs
          // nearly every wait firefox performs, and 20 s matches what
          // fixtures/auth.ts already found this browser needs cold, under the
          // same load, for the same first-paint reason.
          expect: { timeout: 20_000 },
          // The root `retries: 1` above gives every project one retry by
          // default -- a test must fail twice in a row to count as
          // exhausted. maxFailures: 1 (below) then stops the ENTIRE run the
          // moment any single test exhausts its retries. Across ~250+ Firefox
          // test attempts under the same resource contention `expect.timeout`
          // above exists for, a spurious double-failure is close to
          // inevitable even though the large majority of individual
          // failures self-heal on their first retry alone (observed
          // directly: a test that failed its first attempt at 60s passed its
          // retry in 4.3s). This project-level override needs 3 consecutive
          // failures, not 2, before maxFailures triggers -- a genuine
          // deterministic regression still fails fast, because it fails
          // every attempt regardless of how many are allowed; only the
          // false-positive full-suite stop from environmental flakiness gets
          // rarer. Chromium keeps the CLI default of one retry.
          retries: 2,
        },
        {
          name: 'webkit',
          use: { ...devices['Desktop Safari'] },
          // WebKit is the slowest engine here and runs four workers deep in CI,
          // where a first paint can exceed the 5s global expect timeout on an
          // otherwise correct page. This raises the assertion budget for THIS
          // project only, so chromium keeps the tighter bound and a genuine
          // regression there still shows up as one. Raised 15 s -> 20 s with
          // firefox in #883, for the reason spelled out there: this default
          // only started applying to the bulk of the suite's waits once their
          // own `timeout: 10_000` overrides were removed.
          expect: { timeout: 20_000 },
          // Same reasoning as firefox above: one extra retry before
          // maxFailures can trigger, so a run isn't stopped by the same class
          // of environmental flakiness the expect.timeout bump exists for.
          retries: 2,
        },
      ]
      : []),
  ],
});
