import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '../useDebounce'
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 500))
    expect(result.current).toBe('hello')
  })

  it('does not update the value before the delay', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'hello', delay: 500 },
    })

    rerender({ value: 'world', delay: 500 })
    vi.advanceTimersByTime(300)
    expect(result.current).toBe('hello')
  })

  it('updates the value after the delay', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'hello', delay: 500 },
    })

    rerender({ value: 'world', delay: 500 })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current).toBe('world')
  })

  it('only produces the final value on rapid updates', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'a', delay: 300 },
    })

    rerender({ value: 'b', delay: 300 })
    vi.advanceTimersByTime(100)
    rerender({ value: 'c', delay: 300 })
    vi.advanceTimersByTime(100)
    rerender({ value: 'd', delay: 300 })

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current).toBe('d')
  })

  it('cleans up the timer on unmount', () => {
    const { result, rerender, unmount } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'hello', delay: 500 } },
    )

    rerender({ value: 'world', delay: 500 })
    unmount()
    act(() => {
      vi.advanceTimersByTime(500)
    })
    // After unmount the last rendered value should still be the initial one
    expect(result.current).toBe('hello')
  })
})
