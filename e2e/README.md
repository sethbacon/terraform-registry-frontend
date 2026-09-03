<!-- markdownlint-disable MD013 -->
<!-- E2E Test README -->
# Playwright E2E — Developer Notes

## Prerequisites

- Node 24+ and npm
- npx available
- Playwright browsers installed: `npx playwright install chromium`
- Backend and frontend reachable at the `baseURL` configured in `e2e/playwright.config.ts` (default <https://localhost:3000>)
- For dev login fixture, run backend with `DEV_MODE=true` so the dev login endpoint is available.

## Common Commands (from repo root)

```powershell
cd e2e
npm ci
npx playwright install chromium
npx playwright test --workers=1 --retries=0 --reporter=list
npx playwright show-report
```

## Running Tests Locally

- Start backend in DEV_MODE and frontend (or use `deployments/docker-compose.test.yml` to bring up all services).
- Make sure TLS configuration matches `playwright.config.ts` or set `ignoreHTTPSErrors: true` in config.
- Use `--workers=1` for determinism and `--reporter=json` to capture machine-readable results.

## Debugging

- For failing tests, run with `npx playwright show-trace <trace.zip>` to inspect network and DOM.
- Playwright artifacts (videos, traces, screenshots) are written to `e2e/test-results/` by default.

## Waiting for the UI (#883)

Two rules, and the reason for each:

- **Assert, don't `waitForSelector`.** Every wait in `tests/` is an
  auto-retrying `expect(locator).toBeVisible()`. `page.waitForSelector` is
  Playwright-deprecated and, more importantly here, it does not read
  `expect.timeout`, so a suite built on it has no per-project budget at all.

- **Don't pass a `timeout` unless the site genuinely needs more than its
  project gets.** An explicit per-call timeout beats the project's
  `expect.timeout` unconditionally. That is how 119 hand-written
  `timeout: 10_000` waits kept firefox on a 10 s budget after
  `playwright.config.ts` had already raised firefox to 15 s, and why one slow
  Firefox render failed the `v2.27.0` tag run. The budgets now live in
  `playwright.config.ts`: 10 s on chromium, 20 s on firefox and webkit, 30 s
  for navigation (`use.navigationTimeout`, which `page.waitForURL` and
  `page.goto` read). A handful of genuinely slow surfaces — Swagger UI's
  ~1.3 MB chunk, the mirror-admin poll — still override upward on purpose.

`frontend/src/__tests__/e2eWaitBudget.test.ts` enforces both rules, because
neither is visible to `tsc` or to eslint (which does not cover this directory).

When converting a `waitForSelector`, keep the `.first()`:
`page.waitForSelector('a, b')` resolves the selector, takes `elements[0]`, and
waits for **that** element to be visible — it is not "any match is visible".
`page.locator('a, b').first()` is the exact equivalent; a bare locator would
also be a strict-mode violation whenever the selector matches more than one
node.

## Notes

- E2E fixtures assume dev login is available (see `e2e/fixtures/auth.ts`). If you need an alternative auth setup, update the fixture or configure an OAuth test client.
