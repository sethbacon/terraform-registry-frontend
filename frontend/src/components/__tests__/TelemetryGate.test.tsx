import { render, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const initErrorReportingMock = vi.fn()
const destroyErrorReportingMock = vi.fn()
const initPerformanceReportingMock = vi.fn()
const destroyPerformanceReportingMock = vi.fn()

vi.mock('../../services/errorReporting', () => ({
  init: () => initErrorReportingMock(),
  destroy: () => destroyErrorReportingMock(),
}))

vi.mock('../../services/performanceReporting', () => ({
  init: () => initPerformanceReportingMock(),
  destroy: () => destroyPerformanceReportingMock(),
}))

let mockPreferences = {
  essential: true as const,
  errorReporting: false,
  performanceReporting: false,
  analytics: false,
}

vi.mock('../../contexts/ConsentContext', () => ({
  useConsent: () => ({ preferences: mockPreferences }),
}))

import TelemetryGate from '../TelemetryGate'

describe('TelemetryGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPreferences = {
      essential: true,
      errorReporting: false,
      performanceReporting: false,
      analytics: false,
    }
  })

  it('renders nothing', () => {
    const { container } = render(<TelemetryGate />)
    expect(container.innerHTML).toBe('')
  })

  it('does not start either reporter when neither is consented to', () => {
    render(<TelemetryGate />)
    expect(initErrorReportingMock).not.toHaveBeenCalled()
    expect(initPerformanceReportingMock).not.toHaveBeenCalled()
  })

  it('starts only error reporting when only that category is consented to', () => {
    mockPreferences = { ...mockPreferences, errorReporting: true }
    render(<TelemetryGate />)
    expect(initErrorReportingMock).toHaveBeenCalledTimes(1)
    expect(initPerformanceReportingMock).not.toHaveBeenCalled()
  })

  it('starts only performance reporting when only that category is consented to', () => {
    mockPreferences = { ...mockPreferences, performanceReporting: true }
    render(<TelemetryGate />)
    expect(initPerformanceReportingMock).toHaveBeenCalledTimes(1)
    expect(initErrorReportingMock).not.toHaveBeenCalled()
  })

  it('starts both reporters when both categories are consented to', () => {
    mockPreferences = { ...mockPreferences, errorReporting: true, performanceReporting: true }
    render(<TelemetryGate />)
    expect(initErrorReportingMock).toHaveBeenCalledTimes(1)
    expect(initPerformanceReportingMock).toHaveBeenCalledTimes(1)
  })

  it('starts error reporting when consent is granted after initial render (no reload needed)', () => {
    const { rerender } = render(<TelemetryGate />)
    expect(initErrorReportingMock).not.toHaveBeenCalled()

    mockPreferences = { ...mockPreferences, errorReporting: true }
    rerender(<TelemetryGate />)
    expect(initErrorReportingMock).toHaveBeenCalledTimes(1)
  })

  it('stops error reporting when consent is withdrawn after being granted (Art 7(3))', () => {
    mockPreferences = { ...mockPreferences, errorReporting: true }
    const { rerender } = render(<TelemetryGate />)
    expect(initErrorReportingMock).toHaveBeenCalledTimes(1)
    expect(destroyErrorReportingMock).not.toHaveBeenCalled()

    mockPreferences = { ...mockPreferences, errorReporting: false }
    rerender(<TelemetryGate />)
    expect(destroyErrorReportingMock).toHaveBeenCalledTimes(1)
  })

  it('stops performance reporting when consent is withdrawn after being granted', () => {
    mockPreferences = { ...mockPreferences, performanceReporting: true }
    const { rerender } = render(<TelemetryGate />)
    expect(initPerformanceReportingMock).toHaveBeenCalledTimes(1)

    mockPreferences = { ...mockPreferences, performanceReporting: false }
    rerender(<TelemetryGate />)
    expect(destroyPerformanceReportingMock).toHaveBeenCalledTimes(1)
  })

  it('stops both reporters on unmount if consented to', () => {
    mockPreferences = { ...mockPreferences, errorReporting: true, performanceReporting: true }
    const { unmount } = render(<TelemetryGate />)
    act(() => {
      unmount()
    })
    expect(destroyErrorReportingMock).toHaveBeenCalledTimes(1)
    expect(destroyPerformanceReportingMock).toHaveBeenCalledTimes(1)
  })

  it('does not call destroy on unmount if never consented to', () => {
    const { unmount } = render(<TelemetryGate />)
    act(() => {
      unmount()
    })
    expect(destroyErrorReportingMock).not.toHaveBeenCalled()
    expect(destroyPerformanceReportingMock).not.toHaveBeenCalled()
  })
})
