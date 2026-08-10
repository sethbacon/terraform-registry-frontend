import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { captureError, setUser } from '../errorReporting'

describe('errorReporting', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true })
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
    // Reset module state by re-importing
    vi.resetModules()
  })

  describe('init()', () => {
    it('logs initialization message when DSN is configured', async () => {
      // We need to set the env var before importing
      vi.stubEnv('VITE_ERROR_REPORTING_DSN', 'https://errors.example.com/report')

      const { init: freshInit } = await import('../errorReporting')
      freshInit()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Initialized with DSN endpoint'),
      )
    })

    it('logs fallback message when no DSN is configured', async () => {
      vi.stubEnv('VITE_ERROR_REPORTING_DSN', '')

      const { init: freshInit } = await import('../errorReporting')
      freshInit()

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No DSN configured'))
    })
  })

  describe('captureError()', () => {
    it('logs the error to console regardless of DSN', () => {
      const error = new Error('Something broke')
      captureError(error, { page: '/modules' })

      expect(console.error).toHaveBeenCalledWith('[ErrorReporting]', 'Something broke', {
        page: '/modules',
      })
    })

    it('sends error payload via fetch when DSN is configured', async () => {
      vi.stubEnv('VITE_ERROR_REPORTING_DSN', 'https://errors.example.com/report')
      vi.stubEnv('VITE_SENTRY_DSN', '')

      const {
        init: freshInit,
        captureError: freshCapture,
        flush: freshFlush,
      } = await import('../errorReporting')
      freshInit()

      const error = new Error('Test error')
      error.stack = 'Error: Test error\n    at test.ts:1'
      freshCapture(error, { component: 'TestComp' })

      // Errors are batched — flush to trigger the fetch call
      freshFlush()

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://errors.example.com/report',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      // Verify payload structure (batched format)
      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
      expect(body.type).toBe('errors')
      expect(body.entries).toHaveLength(1)
      expect(body.entries[0]).toMatchObject({
        message: 'Test error',
        stack: expect.stringContaining('Test error'),
        context: { component: 'TestComp' },
        timestamp: expect.any(String),
        url: expect.any(String),
        userAgent: expect.any(String),
      })
    })

    it('strips a session token from the recorded url', async () => {
      vi.stubEnv('VITE_ERROR_REPORTING_DSN', 'https://errors.example.com/report')
      vi.stubEnv('VITE_SENTRY_DSN', '')

      const originalLocation = window.location.href
      window.history.pushState({}, '', '/auth/callback?token=super-secret-jwt')

      const {
        init: freshInit,
        captureError: freshCapture,
        flush: freshFlush,
      } = await import('../errorReporting')
      freshInit()
      freshCapture(new Error('Test error'))
      freshFlush()

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
      expect(body.entries[0].url).not.toContain('super-secret-jwt')
      expect(body.entries[0].url).toContain('/auth/callback')

      window.history.pushState({}, '', originalLocation)
    })

    it('does not call fetch when no DSN is configured', () => {
      const error = new Error('No DSN error')
      captureError(error)

      expect(globalThis.fetch).not.toHaveBeenCalled()
    })

    it('gracefully handles fetch failures', async () => {
      vi.stubEnv('VITE_ERROR_REPORTING_DSN', 'https://errors.example.com/report')
      vi.stubEnv('VITE_SENTRY_DSN', '')
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const { init: freshInit, captureError: freshCapture } = await import('../errorReporting')
      freshInit()

      // Should not throw
      expect(() => {
        freshCapture(new Error('Test error'))
      }).not.toThrow()
    })
  })

  describe('Sentry URL sanitization', () => {
    afterEach(() => {
      vi.doUnmock('@sentry/react')
    })

    it('wires beforeSend/beforeBreadcrumb hooks that strip sensitive query params', async () => {
      const initMock = vi.fn()
      vi.doMock('@sentry/react', () => ({ init: initMock }))
      vi.stubEnv('VITE_SENTRY_DSN', 'https://sentry.example.com/dsn')

      const { init: freshInit } = await import('../errorReporting')
      freshInit()

      // Sentry is dynamically imported -- wait for the .then() to run.
      await vi.waitFor(() => expect(initMock).toHaveBeenCalled())

      const config = initMock.mock.calls[0][0] as {
        beforeSend: (event: { request?: { url?: string } }) => unknown
        beforeBreadcrumb: (breadcrumb: { data?: Record<string, string> }) => unknown
      }

      const sentEvent = config.beforeSend({
        request: { url: 'https://app.example.com/callback?token=super-secret-jwt' },
      }) as { request: { url: string } }
      expect(sentEvent.request.url).not.toContain('super-secret-jwt')

      const breadcrumb = config.beforeBreadcrumb({
        data: { url: 'https://app.example.com/callback?token=super-secret-jwt' },
      }) as { data: { url: string } }
      expect(breadcrumb.data.url).not.toContain('super-secret-jwt')

      // History (navigation) breadcrumbs carry root-relative from/to — the OIDC
      // callback transition places the token in exactly those fields.
      const navBreadcrumb = config.beforeBreadcrumb({
        data: { from: '/auth/callback?token=super-secret-jwt', to: '/' },
      }) as { data: { from: string; to: string } }
      expect(navBreadcrumb.data.from).toBe('/auth/callback')
      expect(navBreadcrumb.data.to).toBe('/')
    })
  })

  describe('setUser()', () => {
    it('includes userId in subsequent error reports', async () => {
      vi.stubEnv('VITE_ERROR_REPORTING_DSN', 'https://errors.example.com/report')
      vi.stubEnv('VITE_SENTRY_DSN', '')

      const {
        init: freshInit,
        setUser: freshSetUser,
        captureError: freshCapture,
        flush: freshFlush,
      } = await import('../errorReporting')
      freshInit()
      freshSetUser('user-42')

      freshCapture(new Error('User error'))
      freshFlush()

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
      expect(body.entries[0].userId).toBe('user-42')
    })

    it('logs the user context', () => {
      setUser('user-99')

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('User context set: user-99'))
    })
  })

  describe('breadcrumbs', () => {
    it('addNavigationBreadcrumb includes from/to data', async () => {
      vi.stubEnv('VITE_ERROR_REPORTING_DSN', 'https://errors.example.com/report')
      vi.stubEnv('VITE_SENTRY_DSN', '')

      const mod = await import('../errorReporting')
      mod.init()
      mod.addNavigationBreadcrumb('/home', '/modules')
      mod.captureError(new Error('nav error'))
      mod.flush()

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
      const bc = body.entries[0].breadcrumbs
      expect(bc).toHaveLength(1)
      expect(bc[0].type).toBe('navigation')
      expect(bc[0].data).toEqual({ from: '/home', to: '/modules' })
    })

    it('addApiBreadcrumb records method and status', async () => {
      vi.stubEnv('VITE_ERROR_REPORTING_DSN', 'https://errors.example.com/report')
      vi.stubEnv('VITE_SENTRY_DSN', '')

      const mod = await import('../errorReporting')
      mod.init()
      mod.addApiBreadcrumb('GET', '/api/v1/modules', 200, 42)
      mod.captureError(new Error('api error'))
      mod.flush()

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
      const bc = body.entries[0].breadcrumbs
      expect(bc[0].type).toBe('api')
      expect(bc[0].data).toMatchObject({ method: 'GET', url: '/api/v1/modules', status: 200 })
    })

    it('addConsoleBreadcrumb records message', async () => {
      vi.stubEnv('VITE_ERROR_REPORTING_DSN', 'https://errors.example.com/report')
      vi.stubEnv('VITE_SENTRY_DSN', '')

      const mod = await import('../errorReporting')
      mod.init()
      mod.addConsoleBreadcrumb('test console message')
      mod.captureError(new Error('console error'))
      mod.flush()

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
      expect(body.entries[0].breadcrumbs[0].type).toBe('console')
    })

    it('addCustomBreadcrumb records message and data', async () => {
      vi.stubEnv('VITE_ERROR_REPORTING_DSN', 'https://errors.example.com/report')
      vi.stubEnv('VITE_SENTRY_DSN', '')

      const mod = await import('../errorReporting')
      mod.init()
      mod.addCustomBreadcrumb('user clicked button', { buttonId: 'submit' })
      mod.captureError(new Error('custom error'))
      mod.flush()

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
      expect(body.entries[0].breadcrumbs[0].type).toBe('custom')
      expect(body.entries[0].breadcrumbs[0].data).toEqual({ buttonId: 'submit' })
    })
  })

  describe('destroy()', () => {
    it('clears state and prevents further flushes', async () => {
      vi.stubEnv('VITE_ERROR_REPORTING_DSN', 'https://errors.example.com/report')
      vi.stubEnv('VITE_SENTRY_DSN', '')

      const mod = await import('../errorReporting')
      mod.init()
      mod.captureError(new Error('before destroy'))
      mod.destroy()
      mod.flush()

      // fetch should not be called because destroy clears dsn and buffer
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })
  })

  describe('batch overflow', () => {
    it('auto-flushes when buffer reaches MAX_BATCH_SIZE', async () => {
      vi.stubEnv('VITE_ERROR_REPORTING_DSN', 'https://errors.example.com/report')
      vi.stubEnv('VITE_SENTRY_DSN', '')

      const mod = await import('../errorReporting')
      mod.init()

      // Capture 10 errors (MAX_BATCH_SIZE) to trigger auto-flush
      for (let i = 0; i < 10; i++) {
        mod.captureError(new Error(`error ${i}`))
      }

      // Auto-flush should have been triggered
      expect(globalThis.fetch).toHaveBeenCalled()
    })
  })

  describe('buffer bounding without a DSN', () => {
    it('caps the error buffer when no DSN is configured', async () => {
      // No DSN => flush() is a no-op, so nothing drains the buffer. Without a
      // cap this grows for the lifetime of the page (captureError is wired
      // into every API error path), so assert the retained entries are
      // bounded: capture well past MAX_BATCH_SIZE with reporting inactive,
      // then activate a DSN and flush, and inspect what was retained.
      vi.stubEnv('VITE_ERROR_REPORTING_DSN', '')
      vi.resetModules()
      const mod = await import('../errorReporting')

      for (let i = 0; i < 25; i++) {
        mod.captureError(new Error(`overflow ${i}`))
      }

      // Activate reporting, then drain.
      vi.stubEnv('VITE_ERROR_REPORTING_DSN', 'https://errors.example.com/report')
      mod.init()
      mod.flush()

      expect(globalThis.fetch).toHaveBeenCalled()
      const call = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
      const body = JSON.parse((call[1] as RequestInit).body as string)
      // MAX_BATCH_SIZE is 10; pre-fix this would be all 25.
      expect(body.entries.length).toBeLessThanOrEqual(10)
      // Oldest are evicted first, so the newest error must survive.
      expect(JSON.stringify(body.entries)).toContain('overflow 24')

      mod.destroy()
    })
  })

  // ─── #689: nothing captured before opt-in may be transmitted after it ──────
  //
  // TelemetryGate is the only caller of init(), and it calls it only once the
  // user has opted in — so reaching init() IS the consent transition. captureError
  // runs unconditionally app-wide, so before this fix the first flush after opt-in
  // shipped everything buffered while telemetry was switched off.
  //
  // Every test here stubs a real DSN. Without that, flush() early-returns on
  // `!dsn` and "fetch was not called" would be true no matter what the buffer
  // held — the assertion would pass against completely unfixed code.
  describe('pre-consent buffering (#689)', () => {
    const DSN = 'https://errors.example.com/report'

    it('discards errors captured before init() instead of shipping them', async () => {
      vi.stubEnv('VITE_ERROR_REPORTING_DSN', DSN)
      vi.stubEnv('VITE_SENTRY_DSN', '')

      const mod = await import('../errorReporting')
      // Captured while telemetry is off — the user has not opted in yet.
      mod.captureError(new Error('pre-consent secret'))
      mod.captureError(new Error('another pre-consent one'))

      // The user now opts in.
      mod.init()
      mod.flush()

      expect(globalThis.fetch).not.toHaveBeenCalled()
      mod.destroy()
    })

    it('still reports errors captured after init()', async () => {
      // The control. Without it, deleting the whole reporting path would satisfy
      // the test above, and this suite would be certifying a broken module.
      vi.stubEnv('VITE_ERROR_REPORTING_DSN', DSN)
      vi.stubEnv('VITE_SENTRY_DSN', '')

      const mod = await import('../errorReporting')
      mod.captureError(new Error('pre-consent secret'))
      mod.init()
      mod.captureError(new Error('post-consent error'))
      mod.flush()

      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
      expect(body.entries).toHaveLength(1)
      expect(JSON.stringify(body.entries)).toContain('post-consent error')
      // And the pre-consent one did not ride along in the same batch.
      expect(JSON.stringify(body.entries)).not.toContain('pre-consent secret')
      mod.destroy()
    })

    it('does not attach breadcrumbs collected before init() to a later error', async () => {
      // Breadcrumbs are user-activity data (visited URLs, API calls) and they ride
      // along inside the next error report, so clearing the error buffer alone
      // would still transmit pre-consent history.
      vi.stubEnv('VITE_ERROR_REPORTING_DSN', DSN)
      vi.stubEnv('VITE_SENTRY_DSN', '')

      const mod = await import('../errorReporting')
      mod.addNavigationBreadcrumb('/secret-page', '/another-secret-page')

      mod.init()
      mod.captureError(new Error('post-consent error'))
      mod.flush()

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
      expect(body.entries[0].breadcrumbs).toHaveLength(0)
      expect(JSON.stringify(body.entries)).not.toContain('secret-page')
      mod.destroy()
    })
  })
})
