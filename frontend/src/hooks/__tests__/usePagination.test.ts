import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { usePagination } from '../usePagination'

describe('usePagination', () => {
  it('initializes page at 0 and rowsPerPage at the given default', () => {
    const { result } = renderHook(() => usePagination(25))
    expect(result.current.page).toBe(0)
    expect(result.current.rowsPerPage).toBe(25)
  })

  it('updates the page via handleChangePage', () => {
    const { result } = renderHook(() => usePagination(10))
    act(() => {
      result.current.handleChangePage(null, 2)
    })
    expect(result.current.page).toBe(2)
  })

  it('updates rowsPerPage and resets page to 0 via handleChangeRowsPerPage', () => {
    const { result } = renderHook(() => usePagination(10))
    act(() => {
      result.current.handleChangePage(null, 3)
    })
    expect(result.current.page).toBe(3)

    act(() => {
      result.current.handleChangeRowsPerPage({
        target: { value: '50' },
      } as React.ChangeEvent<HTMLInputElement>)
    })
    expect(result.current.rowsPerPage).toBe(50)
    expect(result.current.page).toBe(0)
  })

  it('exposes setPage for external resets (e.g. filter changes)', () => {
    const { result } = renderHook(() => usePagination(10))
    act(() => {
      result.current.handleChangePage(null, 4)
    })
    act(() => {
      result.current.setPage(0)
    })
    expect(result.current.page).toBe(0)
  })
})
