import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flush, reportNavigation, destroy, init } from '../performanceReporting'

// Mock web-vitals to avoid actual browser API usage
vi.mock('web-vitals', () => ({
  onCLS: vi.fn(),
  onFCP: vi.fn(),
  onLCP: vi.fn(),
  onTTFB: vi.fn(),
  onINP: vi.fn(),
}))

describe('performanceReporting', () => {
  beforeEach(() => {
    destroy()
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    destroy()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('flush', () => {
    it('does nothing when buffer is empty', () => {
      const sendBeaconSpy = vi.spyOn(navigator, 'sendBeacon').mockReturnValue(true)
      flush()
      expect(sendBeaconSpy).not.toHaveBeenCalled()
    })

    it('does nothing when dsn is null', () => {
      // Without calling init(), dsn is null
      reportNavigation('/test', 100)
      const sendBeaconSpy = vi.spyOn(navigator, 'sendBeacon').mockReturnValue(true)
      flush()
      // sendBeacon shouldn't be called because dsn is null
      expect(sendBeaconSpy).not.toHaveBeenCalled()
    })
  })

  describe('reportNavigation', () => {
    it('logs to the console in dev mode even before the service is active', () => {
      // Dev-mode logging never leaves the browser, so it stays unconditional
      // even pre-consent/pre-init -- only buffering (see below) is gated.
      reportNavigation('/admin/users', 150.5)
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[Perf] Navigation'))
    })

    it('logs the route name and duration in dev mode', () => {
      reportNavigation('/modules', 42.3)
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('/modules'))
    })

    it('does not enqueue navigation entries before the service is active (no consent yet)', () => {
      // useNavigationBreadcrumbs.ts calls reportNavigation unconditionally on
      // every SPA route change, regardless of consent. Without a guard, these
      // pre-consent navigations would sit in the buffer and then leak out on
      // the very first flush once the user later grants consent and init()
      // configures a DSN -- reporting on browsing history recorded before the
      // user ever agreed to it.
      for (let i = 0; i < 100; i++) {
        reportNavigation(`/route-${i}`, i)
      }

      // Consent granted afterwards: init() resolves a DSN.
      vi.stubEnv('VITE_PERFORMANCE_DSN', 'https://perf.example.com/report')
      init()

      vi.spyOn(navigator, 'sendBeacon').mockReturnValue(false)
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())
      flush()

      // None of the pre-consent navigations should ever have been buffered,
      // so there is nothing to flush.
      expect(fetchSpy).not.toHaveBeenCalled()

      vi.unstubAllEnvs()
    })

    it('bounds buffer growth once active, even under a heavy navigation burst', () => {
      vi.stubEnv('VITE_PERFORMANCE_DSN', 'https://perf.example.com/report')
      init()

      const sendBeaconSpy = vi.spyOn(navigator, 'sendBeacon').mockReturnValue(true)

      // With the service already active, each batch of MAX_BATCH_SIZE (25)
      // entries triggers an eager flush, so the buffer should never be
      // allowed to grow past that regardless of how many navigations fire
      // in a row.
      for (let i = 0; i < 100; i++) {
        reportNavigation(`/route-${i}`, i)
      }

      // 100 entries at a 25-entry batch size flush in exactly 4 batches.
      expect(sendBeaconSpy).toHaveBeenCalledTimes(4)
      const lastCall = sendBeaconSpy.mock.calls[sendBeaconSpy.mock.calls.length - 1]
      const lastBody = JSON.parse(lastCall[1] as string)
      expect(lastBody.entries.length).toBe(25)
      expect(lastBody.entries.at(-1).name).toBe('/route-99')

      vi.unstubAllEnvs()
    })
  })

  describe('init', () => {
    it('logs initialization message without DSN', () => {
      init()
      expect(console.log).toHaveBeenCalledWith(
        '[Perf] No DSN configured — metrics logged to console only',
      )
    })

    it('registers web vitals callbacks', async () => {
      init()
      // Allow the dynamic import to resolve
      await vi.dynamicImportSettled()
      const webVitals = await import('web-vitals')
      expect(webVitals.onCLS).toHaveBeenCalled()
      expect(webVitals.onFCP).toHaveBeenCalled()
      expect(webVitals.onLCP).toHaveBeenCalled()
      expect(webVitals.onTTFB).toHaveBeenCalled()
      expect(webVitals.onINP).toHaveBeenCalled()
    })

    it('sets up flush interval', () => {
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
      init()
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10_000)
    })
  })

  describe('destroy', () => {
    it('clears the flush interval', () => {
      init()
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
      destroy()
      expect(clearIntervalSpy).toHaveBeenCalled()
    })

    it('is safe to call multiple times', () => {
      destroy()
      destroy()
      // No errors thrown
    })
  })

  describe('flush with DSN', () => {
    it('sends buffered entries via sendBeacon when DSN configured', async () => {
      vi.stubEnv('VITE_PERFORMANCE_DSN', 'https://perf.example.com/report')
      vi.resetModules()

      const mod = await import('../performanceReporting')
      mod.init()

      mod.reportNavigation('/test', 100)

      const sendBeaconSpy = vi.spyOn(navigator, 'sendBeacon').mockReturnValue(true)
      mod.flush()
      expect(sendBeaconSpy).toHaveBeenCalledWith(
        'https://perf.example.com/report',
        expect.any(String),
      )

      mod.destroy()
    })

    it('falls back to fetch when sendBeacon returns false', async () => {
      vi.stubEnv('VITE_PERFORMANCE_DSN', 'https://perf.example.com/report')
      vi.resetModules()

      const mod = await import('../performanceReporting')
      mod.init()

      mod.reportNavigation('/test', 100)

      vi.spyOn(navigator, 'sendBeacon').mockReturnValue(false)
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())
      mod.flush()
      expect(fetchSpy).toHaveBeenCalled()

      mod.destroy()
    })

    it('strips a session token from reportNavigation entries', async () => {
      vi.stubEnv('VITE_PERFORMANCE_DSN', 'https://perf.example.com/report')
      vi.resetModules()

      const originalLocation = window.location.href
      window.history.pushState({}, '', '/auth/callback?token=super-secret-jwt')

      const mod = await import('../performanceReporting')
      mod.init()
      mod.reportNavigation('/test', 100)

      vi.spyOn(navigator, 'sendBeacon').mockReturnValue(false)
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())
      mod.flush()

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.entries[0].url).not.toContain('super-secret-jwt')
      expect(body.entries[0].url).toContain('/auth/callback')

      window.history.pushState({}, '', originalLocation)
      mod.destroy()
    })

    it('strips a session token from web-vitals metric entries', async () => {
      vi.stubEnv('VITE_PERFORMANCE_DSN', 'https://perf.example.com/report')
      vi.resetModules()

      const originalLocation = window.location.href
      window.history.pushState({}, '', '/auth/callback?token=super-secret-jwt')

      const webVitals = await import('web-vitals')
      const mod = await import('../performanceReporting')
      mod.init()
      await vi.dynamicImportSettled()

      // Invoke the callback this test's init() registered with onCLS (mock.calls
      // accumulates across tests in this file, so grab the most recent registration
      // rather than the first -- an earlier test's stale handler closes over an
      // already-destroyed module instance's buffer).
      const onCLSMock = webVitals.onCLS as unknown as { mock: { calls: unknown[][] } }
      const lastCall = onCLSMock.mock.calls[onCLSMock.mock.calls.length - 1]
      const handleMetric = lastCall[0] as (metric: unknown) => void
      handleMetric({ name: 'CLS', value: 0.05, rating: 'good', navigationType: 'navigate' })

      vi.spyOn(navigator, 'sendBeacon').mockReturnValue(false)
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())
      mod.flush()

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.entries[0].url).not.toContain('super-secret-jwt')
      expect(body.entries[0].url).toContain('/auth/callback')

      window.history.pushState({}, '', originalLocation)
      mod.destroy()
    })
  })

  describe('web vitals callback', () => {
    it('init registers all five web vitals', async () => {
      vi.resetModules()
      const webVitals = await import('web-vitals')
      const mod = await import('../performanceReporting')
      mod.init()
      await vi.dynamicImportSettled()

      expect(webVitals.onCLS).toHaveBeenCalled()
      expect(webVitals.onFCP).toHaveBeenCalled()
      expect(webVitals.onLCP).toHaveBeenCalled()
      expect(webVitals.onTTFB).toHaveBeenCalled()
      expect(webVitals.onINP).toHaveBeenCalled()

      mod.destroy()
    })
  })
})
