import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHotkey } from '../useHotkey'

function dispatch(key: string, opts: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', { key, ...opts })
  window.dispatchEvent(event)
  return event
}

describe('useHotkey', () => {
  it('fires on mod+k with meta on macOS', () => {
    const cb = vi.fn()
    renderHook(() => useHotkey('mod+k', cb))
    dispatch('k', { metaKey: true })
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('fires on mod+k with ctrl on non-mac', () => {
    const cb = vi.fn()
    renderHook(() => useHotkey('mod+k', cb))
    dispatch('k', { ctrlKey: true })
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('ignores bare k without modifier', () => {
    const cb = vi.fn()
    renderHook(() => useHotkey('mod+k', cb))
    dispatch('k')
    expect(cb).not.toHaveBeenCalled()
  })

  it('ignores other keys with modifier', () => {
    const cb = vi.fn()
    renderHook(() => useHotkey('mod+k', cb))
    dispatch('j', { metaKey: true })
    expect(cb).not.toHaveBeenCalled()
  })

  it('detaches listener on unmount', () => {
    const cb = vi.fn()
    const { unmount } = renderHook(() => useHotkey('mod+k', cb))
    unmount()
    dispatch('k', { metaKey: true })
    expect(cb).not.toHaveBeenCalled()
  })

  it('does not fire when disabled', () => {
    const cb = vi.fn()
    renderHook(() => useHotkey('mod+k', cb, { enabled: false }))
    dispatch('k', { metaKey: true })
    expect(cb).not.toHaveBeenCalled()
  })
})
