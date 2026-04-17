import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { captureError, setUser } from '../errorReporting'

describe('errorReporting', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true })
    vi.spyOn(console, 'log').mockImplementation(() => { })
    vi.spyOn(console, 'error').mockImplementation(() => { })
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
        expect.stringContaining('Initialized with DSN endpoint')
      )
    })

    it('logs fallback message when no DSN is configured', async () => {
      vi.stubEnv('VITE_ERROR_REPORTING_DSN', '')

      const { init: freshInit } = await import('../errorReporting')
      freshInit()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No DSN configured')
      )
    })
  })

  describe('captureError()', () => {
    it('logs the error to console regardless of DSN', () => {
      const error = new Error('Something broke')
      captureError(error, { page: '/modules' })

      expect(console.error).toHaveBeenCalledWith(
        '[ErrorReporting]',
        'Something broke',
        { page: '/modules' }
      )
    })

    it('sends error payload via fetch when DSN is configured', async () => {
      vi.stubEnv('VITE_ERROR_REPORTING_DSN', 'https://errors.example.com/report')
      vi.stubEnv('VITE_SENTRY_DSN', '')

      const { init: freshInit, captureError: freshCapture, flush: freshFlush } = await import('../errorReporting')
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
        })
      )

      // Verify payload structure (batched format)
      const body = JSON.parse(
        (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
      )
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

      const body = JSON.parse(
        (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
      )
      expect(body.entries[0].userId).toBe('user-42')
    })

    it('logs the user context', () => {
      setUser('user-99')

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('User context set: user-99')
      )
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

      const body = JSON.parse(
        (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
      )
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

      const body = JSON.parse(
        (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
      )
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

      const body = JSON.parse(
        (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
      )
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

      const body = JSON.parse(
        (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
      )
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
})
