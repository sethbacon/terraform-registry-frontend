<!-- E2E Test README -->
# Playwright E2E — Developer Notes

Prerequisites

- Node 18+ and npm
- npx available
- Playwright browsers installed: `npx playwright install chromium`
- Backend and frontend reachable at the `baseURL` configured in `e2e/playwright.config.ts` (default <https://localhost:3000>)
- For dev login fixture, run backend with `DEV_MODE=true` so the dev login endpoint is available.

Common commands (from repo root)

```powershell
cd e2e
npm ci
npx playwright install chromium
npx playwright test --workers=1 --retries=0 --reporter=list
npx playwright show-report
```

Running tests locally

- Start backend in DEV_MODE and frontend (or use `deployments/docker-compose.test.yml` to bring up all services).
- Make sure TLS configuration matches `playwright.config.ts` or set `ignoreHTTPSErrors: true` in config.
- Use `--workers=1` for determinism and `--reporter=json` to capture machine-readable results.

Debugging

- For failing tests, run with `npx playwright show-trace <trace.zip>` to inspect network and DOM.
- Playwright artifacts (videos, traces, screenshots) are written to `e2e/test-results/` by default.

Notes

- E2E fixtures assume dev login is available (see `e2e/fixtures/auth.ts`). If you need an alternative auth setup, update the fixture or configure an OAuth test client.
