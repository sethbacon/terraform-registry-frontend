import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { useOnlineStatus } from '../useOnlineStatus'

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  })
}

describe('useOnlineStatus', () => {
  afterEach(() => {
    setNavigatorOnline(true)
  })

  it('seeds from navigator.onLine (online)', () => {
    setNavigatorOnline(true)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)
  })

  it('seeds from navigator.onLine (offline)', () => {
    setNavigatorOnline(false)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)
  })

  it('flips to false on the offline event', () => {
    setNavigatorOnline(true)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)
  })

  it('flips back to true on the online event', () => {
    setNavigatorOnline(false)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(true)
  })

  it('removes its event listeners on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useOnlineStatus())

    const addedTypes = addSpy.mock.calls.map((c) => c[0])
    expect(addedTypes).toContain('online')
    expect(addedTypes).toContain('offline')

    unmount()

    const removedTypes = removeSpy.mock.calls.map((c) => c[0])
    expect(removedTypes).toContain('online')
    expect(removedTypes).toContain('offline')

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
