import { afterEach, describe, expect, it, vi } from 'vitest'

// Issue #692 — the cross-origin CSRF misconfiguration warning was unwired in
// tests.
//
// checkCsrfOriginConfig is well covered as a pure function, but nothing
// exercised the module-load-time wiring that calls it. API_BASE_URL is computed
// once at import and the console.error fires exactly once per module load, so a
// refactor that dropped the `if (csrfOriginWarning)` block — or broke the
// API_BASE_URL / window.location.origin arguments feeding it — would leave every
// pure-function test green while the startup diagnostic went silent.
//
// This is the difference between testing the decision and testing that anyone
// asks for it. The decision was covered; the asking was not.

describe('cross-origin CSRF startup warning (module wiring)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('logs an error naming the misconfigured origin when the API is cross-origin', async () => {
    // DEV must be false: API_BASE_URL is `import.meta.env.DEV ? '' : VITE_API_URL`,
    // and under vitest DEV is true by default, so the check short-circuits on the
    // empty base URL and this test would pass against a completely unwired module.
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_API_URL', 'https://api.elsewhere.example')

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.resetModules()
    await import('../http')

    // Matched by CONTENT rather than by call index, so an unrelated load-time
    // log added later cannot silently shift which call is inspected.
    const messages = consoleError.mock.calls.map((c) => String(c[0] ?? ''))
    const warning = messages.find((m) => m.includes('VITE_API_URL'))
    expect(
      warning,
      `no CSRF-origin warning was logged; saw: ${JSON.stringify(messages)}`,
    ).toBeDefined()
    // The misconfigured origin has to appear, or the operator cannot tell which
    // setting is wrong from the console alone.
    expect(warning).toContain('https://api.elsewhere.example')
    expect(warning).toContain('tfr_csrf')
    // Exactly one: the block runs once per module load, and a duplicate would
    // mean the wiring had been added twice.
    expect(messages.filter((m) => m.includes('VITE_API_URL'))).toHaveLength(1)
  })

  it('stays silent when the API is same-origin', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_API_URL', window.location.origin)

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.resetModules()
    await import('../http')

    expect(consoleError.mock.calls.map((c) => String(c[0] ?? ''))).not.toContainEqual(
      expect.stringContaining('VITE_API_URL'),
    )
  })

  it('stays silent for a relative base URL', async () => {
    // "" and "/api" are same-origin by construction. A warning here would fire on
    // every correctly-configured deployment and be tuned out.
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_API_URL', '/api')

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.resetModules()
    await import('../http')

    expect(consoleError.mock.calls.map((c) => String(c[0] ?? ''))).not.toContainEqual(
      expect.stringContaining('VITE_API_URL'),
    )
  })
})
