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
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Perf] Navigation')
      )
    })

    it('logs the route name and duration in dev mode', () => {
      reportNavigation('/modules', 42.3)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('/modules')
      )
    })
  })

  describe('init', () => {
    it('logs initialization message without DSN', () => {
      init()
      expect(console.log).toHaveBeenCalledWith(
        '[Perf] No DSN configured — metrics logged to console only'
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
})
