import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useStatusMessage } from '../useStatusMessage'

describe('useStatusMessage', () => {
  it('starts with no messages', () => {
    const { result } = renderHook(() => useStatusMessage())
    expect(result.current.error).toBeNull()
    expect(result.current.success).toBeNull()
  })

  it('records an error and a success independently', () => {
    const { result } = renderHook(() => useStatusMessage())
    act(() => result.current.setError('boom'))
    expect(result.current.error).toBe('boom')
    expect(result.current.success).toBeNull()

    act(() => result.current.setSuccess('saved'))
    expect(result.current.success).toBe('saved')
  })

  // The pages this hook replaced never cleared a success banner when a later
  // action failed, so setError must not do it either.
  it('leaves an existing success in place when an error arrives', () => {
    const { result } = renderHook(() => useStatusMessage())
    act(() => result.current.setSuccess('saved'))
    act(() => result.current.setError('boom'))
    expect(result.current.error).toBe('boom')
    expect(result.current.success).toBe('saved')
  })

  // This is the clear-on-next-action wiring the pages each carried by hand as
  // `setSuccess(msg); setError(null)`.
  it('showSuccess records the success and drops the error still on screen', () => {
    const { result } = renderHook(() => useStatusMessage())
    act(() => result.current.setError('boom'))
    act(() => result.current.showSuccess('saved'))
    expect(result.current.success).toBe('saved')
    expect(result.current.error).toBeNull()
  })

  it('clear wipes both messages', () => {
    const { result } = renderHook(() => useStatusMessage())
    act(() => {
      result.current.setError('boom')
      result.current.setSuccess('saved')
    })
    act(() => result.current.clear())
    expect(result.current.error).toBeNull()
    expect(result.current.success).toBeNull()
  })

  it('dismisses one message without disturbing the other', () => {
    const { result } = renderHook(() => useStatusMessage())
    act(() => {
      result.current.setError('boom')
      result.current.setSuccess('saved')
    })
    act(() => result.current.setError(null))
    expect(result.current.error).toBeNull()
    expect(result.current.success).toBe('saved')
  })

  it('keeps showSuccess and clear stable across renders', () => {
    const { result, rerender } = renderHook(() => useStatusMessage())
    const { showSuccess, clear } = result.current
    rerender()
    expect(result.current.showSuccess).toBe(showSuccess)
    expect(result.current.clear).toBe(clear)
  })
})
