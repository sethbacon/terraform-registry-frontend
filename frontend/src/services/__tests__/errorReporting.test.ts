import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { init, captureError, setUser } from '../errorReporting'

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

      const { init: freshInit, captureError: freshCapture } = await import('../errorReporting')
      freshInit()

      const error = new Error('Test error')
      error.stack = 'Error: Test error\n    at test.ts:1'
      freshCapture(error, { component: 'TestComp' })

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://errors.example.com/report',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )

      // Verify payload structure
      const body = JSON.parse(
        (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
      )
      expect(body).toMatchObject({
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

      const {
        init: freshInit,
        setUser: freshSetUser,
        captureError: freshCapture,
      } = await import('../errorReporting')
      freshInit()
      freshSetUser('user-42')

      freshCapture(new Error('User error'))

      const body = JSON.parse(
        (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
      )
      expect(body.userId).toBe('user-42')
    })

    it('logs the user context', () => {
      setUser('user-99')

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('User context set: user-99')
      )
    })
  })
})
