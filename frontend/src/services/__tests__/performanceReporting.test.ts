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
    it('enqueues a navigation entry', () => {
      // reportNavigation pushes to buffer even without dsn
      reportNavigation('/admin/users', 150.5)
      // We can verify the log in dev mode
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[Perf] Navigation'))
    })

    it('logs the route name and duration in dev mode', () => {
      reportNavigation('/modules', 42.3)
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('/modules'))
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
