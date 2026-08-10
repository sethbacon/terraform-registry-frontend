import { test, expect } from '@playwright/test';

/**
 * Security-abuse E2E tests (issue #489).
 *
 * The rest of the e2e suite verifies page shape and the client-side route
 * guard, but never drives an abuse scenario end-to-end. These tests exercise
 * the three highest-value defences in this app's threat model against a live
 * stack: XSS in fetched README content, CSRF on real mutations, and open
 * redirect after login. Each would catch a regression in the corresponding
 * app-side control (rehype-sanitize, the double-submit CSRF middleware, the
 * callback origin check) that the existing structural tests would not.
 */

const ORIGIN = new URL(process.env.BASE_URL ?? 'https://localhost:3000').origin;

// ---------------------------------------------------------------------------
// 1. XSS — a module README with active-content payloads renders inert
// ---------------------------------------------------------------------------
// MarkdownRenderer runs react-markdown with rehype-sanitize and no rehype-raw,
// so raw <script>/<img onerror> HTML is never parsed to live DOM and
// javascript: URLs in markdown links/images are stripped. We mock the module
// API so the assertion does not depend on seed data, then prove the payload is
// inert on the real rendered page.
test.describe('XSS: malicious README is rendered inert', () => {
  const NS = 'evil';
  const NAME = 'payload';
  const SYSTEM = 'aws';

  // Every payload writes window.__xssFired if it ever executes.
  const README = [
    '# Malicious README',
    '',
    '<script>window.__xssFired = true;</script>',
    '',
    '<img src="x" onerror="window.__xssFired = true" />',
    '',
    '<a href="javascript:window.__xssFired = true">raw anchor</a>',
    '',
    '[markdown link](javascript:window.__xssFired=true)',
    '',
    '![markdown image](javascript:window.__xssFired=true)',
    '',
    'Some trailing safe text.',
  ].join('\n');

  test('script/onerror do not execute and javascript: URLs are stripped', async ({ page }) => {
    // Flag must exist before any page script runs so we can prove it stays false.
    await page.addInitScript(() => {
      (window as unknown as { __xssFired: boolean }).__xssFired = false;
    });
    // A surviving javascript: link would surface as a dialog when activated;
    // fail loudly if one ever fires.
    page.on('dialog', (dialog) => {
      throw new Error(`Unexpected dialog (XSS executed): ${dialog.message()}`);
    });

    const moduleBody = {
      id: 'mod-xss',
      namespace: NS,
      name: NAME,
      system: SYSTEM,
      description: 'Module used to verify README sanitisation.',
      download_count: 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      versions: [
        {
          id: 'ver-xss',
          module_id: 'mod-xss',
          version: '1.0.0',
          download_count: 0,
          deprecated: false,
          readme: README,
        },
      ],
    };

    // getModule — the detail + embedded version (carrying the README).
    await page.route(`**/api/v1/modules/${NS}/${NAME}/${SYSTEM}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(moduleBody),
      }),
    );
    // getModuleVersions — registry-protocol endpoint; empty so the hook falls
    // back to the embedded versions above.
    await page.route(`**/v1/modules/${NS}/${NAME}/${SYSTEM}/versions`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ modules: [{ versions: [] }] }),
      }),
    );
    // getModuleDocs — 404 so the docs query resolves to null (README tab only).
    await page.route(`**/api/v1/modules/${NS}/${NAME}/${SYSTEM}/versions/**/docs`, (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }),
    );

    await page.goto(`/modules/${NS}/${NAME}/${SYSTEM}`);

    // Detail page rendered (h1 is the module name).
    await expect(page.getByRole('heading', { level: 1, name: NAME })).toBeVisible({
      timeout: 15_000,
    });

    // The rendered-documentation region exists and shows the safe text.
    const region = page.getByRole('region', { name: 'Rendered documentation' });
    await expect(region).toContainText('Some trailing safe text.');

    // No active content survived sanitisation: no inline error handlers, no
    // javascript: URLs anywhere on the page, and no <script> injected into the
    // rendered documentation region (scoped so the app's own scripts don't
    // count).
    expect(await page.locator('[onerror]').count()).toBe(0);
    expect(await page.locator('a[href^="javascript:"]').count()).toBe(0);
    expect(await page.locator('img[src^="javascript:"]').count()).toBe(0);
    expect(await region.locator('script').count()).toBe(0);

    // And nothing ever executed.
    const fired = await page.evaluate(
      () => (window as unknown as { __xssFired: boolean }).__xssFired,
    );
    expect(fired).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. CSRF — a cookie-authenticated mutation without X-CSRF-Token is rejected
// ---------------------------------------------------------------------------
// The double-submit CSRF middleware only guards *cookie*-authenticated
// mutations; Bearer-token requests are exempt. Dev-login is cookie-native
// (issue #584: it sets tfr_auth_token/tfr_csrf via Set-Cookie and no longer
// returns a JWT in the response body), so calling it through context.request
// — which shares its cookie jar with `context`/`page`, unlike the isolated
// top-level `request` fixture — gives this test a genuine cookie session for
// free. We then read back the real tfr_csrf value the server set and fire a
// real mutating request (POST /auth/refresh) against the live backend with
// and without it.
test.describe('CSRF: mutation missing the token header is rejected by the backend', () => {
  test('POST without X-CSRF-Token gets 403; the same request with it does not', async ({
    page,
    context,
  }) => {
    // Dev-login (dev-mode only) sets the session cookies directly on this
    // context. Skip cleanly if the backend is not in DEV_MODE, matching the
    // rest of the suite.
    const loginResp = await context.request.post('/api/v1/dev/login');
    test.skip(!loginResp.ok(), 'Dev login unavailable — backend not in DEV_MODE');

    const cookies = await context.cookies();
    const csrfCookie = cookies.find((c) => c.name === 'tfr_csrf');
    expect(csrfCookie?.value, 'dev login set the tfr_csrf cookie').toBeTruthy();
    const CSRF_VALUE = csrfCookie!.value;

    // Need a document in this origin so the fetch() below is same-origin and
    // carries the cookies. /login is public and cheap.
    await page.goto('/login');

    // (a) No CSRF header -> backend must reject the mutation with 403.
    const withoutHeader = await page.evaluate(async () => {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      return res.status;
    });
    expect(withoutHeader, 'CSRF-less cookie mutation is forbidden').toBe(403);

    // (b) Same request WITH the matching header -> not 403 (proves the 403 in
    // (a) was specifically the missing CSRF header, not auth or the endpoint).
    const withHeader = await page.evaluate(async (csrf) => {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrf },
      });
      return res.status;
    }, CSRF_VALUE);
    expect(withHeader, 'valid double-submit request passes the CSRF gate').not.toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 3. Open redirect — a crafted returnUrl after login cannot leave the origin
// ---------------------------------------------------------------------------
// CallbackPage resolves sessionStorage.returnUrl against window.location.origin
// and only honours it when the resolved origin matches; otherwise it falls back
// to "/". Drive the callback with hostile returnUrl values and assert the
// browser never leaves this origin, while a legitimate same-origin path is
// still honoured.
test.describe('Open redirect: OIDC callback returnUrl cannot escape the origin', () => {
  const hostile = [
    'https://evil.example.com/phish',
    '//evil.example.com/phish',
    'https:evil.example.com',
    '/\\evil.example.com',
    'javascript:alert(document.domain)',
  ];

  for (const returnUrl of hostile) {
    test(`neutralises hostile returnUrl ${JSON.stringify(returnUrl)}`, async ({ page }) => {
      page.on('dialog', (dialog) => {
        throw new Error(`Unexpected dialog (redirect executed script): ${dialog.message()}`);
      });

      // Seed the return URL exactly as the login flow would, then drive the
      // callback (no token/error params -> it just consumes returnUrl).
      await page.goto('/login');
      await page.evaluate((url) => sessionStorage.setItem('returnUrl', url), returnUrl);
      await page.goto('/auth/callback');

      // The callback replaces the location; wait for it to leave /auth/callback.
      await page.waitForURL((url) => !url.pathname.startsWith('/auth/callback'), {
        timeout: 15_000,
      });

      // Whatever it landed on must be same-origin (never evil.example.com).
      expect(new URL(page.url()).origin).toBe(ORIGIN);
    });
  }

  test('preserves a legitimate same-origin returnUrl', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => sessionStorage.setItem('returnUrl', '/modules?q=safe'));
    await page.goto('/auth/callback');

    await page.waitForURL((url) => url.pathname === '/modules', { timeout: 15_000 });
    const landed = new URL(page.url());
    expect(landed.origin).toBe(ORIGIN);
    expect(landed.pathname).toBe('/modules');
    expect(landed.searchParams.get('q')).toBe('safe');
  });
});

// ---------------------------------------------------------------------------
// 4. Response headers — the security headers nginx declares actually ship
// ---------------------------------------------------------------------------
// Issue #691. nginxHeaderInheritance.test.ts already parses the config files
// statically, but a static parse cannot see whether nginx *serves* what the file
// declares. This asserts the delivered response, which is the only thing a
// browser acts on.
//
// The compose stack these tests run against serves frontend/nginx.conf (see
// frontend/Dockerfile: it is COPYd to conf.d/default.conf and is the default
// whenever BACKEND_URL is unset). nginx-ecs.conf.template is NOT exercised here
// -- it is selected by the entrypoint only when BACKEND_URL is set, so it has no
// running instance to interrogate and remains covered by the static test alone.
test.describe('Response headers: the nginx security headers reach the browser', () => {
  // Exact values, not mere presence: `X-Frame-Options: ALLOWALL` and a
  // `max-age=0` HSTS are both "present" while defending nothing.
  const EXPECTED: Record<string, string> = {
    'x-frame-options': 'DENY',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'strict-transport-security': 'max-age=63072000; includeSubDomains',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  };

  // Asserted as substrings rather than one whole-string compare so the
  // per-request nonce in style-src does not have to be reconstructed here, and
  // so a failure names the directive that went missing instead of diffing a
  // 300-character line.
  const CSP_DIRECTIVES = [
    "default-src 'self'",
    "script-src 'self'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  // Two paths, deliberately at the two different nginx levels.
  //
  // /terraform/ is the one that matters most. nginx's add_header is
  // REPLACE-BY-LEVEL, not additive: a location that declares any add_header of
  // its own inherits none from the server block. /terraform/ declares
  // `add_header Content-Type`, so it drops all six unless they are re-declared
  // there -- and it is the one same-origin path serving content the operator did
  // not author (provider metadata proxied from third-party registries).
  //
  // Verified against real nginx before this test was written: deleting the six
  // re-declarations from the /terraform/ block takes that path from six security
  // headers to ZERO while / still reports six. A test that only checked / would
  // have stayed green through exactly that regression.
  const PATHS: [string, string][] = [
    ['/', 'the SPA document (server level)'],
    ['/terraform/example.com/hashicorp/aws/index.json', 'the network-mirror proxy (location level)'],
  ];

  for (const [path, what] of PATHS) {
    test(`sends every security header on ${what}`, async ({ request }) => {
      // No status assertion: these are declared `always`, so they must ship on
      // error responses too. Pinning a status here would make the test depend on
      // upstream seed data rather than on the header policy.
      const res = await request.get(path);
      const headers = res.headers();

      for (const [name, value] of Object.entries(EXPECTED)) {
        expect(headers[name], `${name} missing or wrong on ${path} (status ${res.status()})`).toBe(
          value,
        );
      }

      const csp = headers['content-security-policy'];
      expect(csp, `Content-Security-Policy missing on ${path}`).toBeTruthy();
      for (const directive of CSP_DIRECTIVES) {
        expect(csp, `CSP on ${path} lost "${directive}"`).toContain(directive);
      }
    });
  }

  // The nonce the header authorises must be the nonce the document carries.
  //
  // If they diverge, the browser blocks every style Emotion/MUI injects and the
  // app renders unstyled -- a real, user-visible break that no unit test sees.
  // Both values are read from a SINGLE response on purpose: the nonce derives
  // from $request_id, so two separate requests legitimately carry different
  // nonces and comparing across them would be flaky by construction.
  //
  // Verified to catch the sub_filter rewrite being dropped (the document then
  // keeps the literal __CSP_NONCE__ placeholder while the header carries a real
  // nonce). It does NOT distinguish the `map` form from a plain
  // `set $csp_nonce $request_id` -- checked directly against nginx, both agree
  // on current nginx -- so this guards nonce delivery, not that particular
  // config idiom.
  test('CSP style-src nonce matches the nonce in the served document', async ({ request }) => {
    const res = await request.get('/');
    const csp = res.headers()['content-security-policy'] ?? '';
    const body = await res.text();

    const headerNonce = /style-src[^;]*'nonce-([^']+)'/.exec(csp)?.[1];
    expect(headerNonce, `no style-src nonce in CSP: ${csp}`).toBeTruthy();

    const metaNonce = /<meta[^>]+name="csp-nonce"[^>]+content="([^"]*)"/.exec(body)?.[1];
    expect(metaNonce, 'no <meta name="csp-nonce"> in the served document').toBeTruthy();

    // Called out separately: an unsubstituted placeholder is the specific
    // symptom of the sub_filter rewrite failing, and reads far better in CI than
    // "expected 'abc123' to be '__CSP_NONCE__'".
    expect(metaNonce, 'the __CSP_NONCE__ placeholder was never substituted by nginx').not.toBe(
      '__CSP_NONCE__',
    );
    expect(metaNonce).toBe(headerNonce);
  });
});
