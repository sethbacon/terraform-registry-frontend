import { renderHook, act } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useNavigationBreadcrumbs } from '../useNavigationBreadcrumbs'
import * as errorReporting from '../../services/errorReporting'
import * as performanceReporting from '../../services/performanceReporting'
import type { ReactNode } from 'react'

/** Helper that calls useNavigationBreadcrumbs AND exposes navigate so tests can trigger route changes. */
let navigateFn: ReturnType<typeof useNavigate>
function useNavigationBreadcrumbsWithNav() {
  navigateFn = useNavigate()
  useNavigationBreadcrumbs()
}

function createWrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  }
}

describe('useNavigationBreadcrumbs', () => {
  beforeEach(() => {
    vi.spyOn(errorReporting, 'addNavigationBreadcrumb')
    vi.spyOn(performanceReporting, 'reportNavigation')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not record a breadcrumb on initial render', () => {
    renderHook(() => useNavigationBreadcrumbsWithNav(), { wrapper: createWrapper(['/home']) })

    expect(errorReporting.addNavigationBreadcrumb).not.toHaveBeenCalled()
  })

  it('records a breadcrumb with from/to on route change', () => {
    renderHook(() => useNavigationBreadcrumbsWithNav(), { wrapper: createWrapper(['/home']) })

    act(() => {
      navigateFn('/modules')
    })

    expect(errorReporting.addNavigationBreadcrumb).toHaveBeenCalledWith('/home', '/modules')
  })

  it('reports navigation timing for the destination route on route change', () => {
    renderHook(() => useNavigationBreadcrumbsWithNav(), { wrapper: createWrapper(['/home']) })

    expect(performanceReporting.reportNavigation).not.toHaveBeenCalled()

    act(() => {
      navigateFn('/modules')
    })

    expect(performanceReporting.reportNavigation).toHaveBeenCalledWith(
      '/modules',
      expect.any(Number),
    )
    const [, durationMs] = vi.mocked(performanceReporting.reportNavigation).mock.calls[0]
    expect(durationMs).toBeGreaterThanOrEqual(0)
  })

  it('does not report navigation timing when the path is unchanged', () => {
    renderHook(() => useNavigationBreadcrumbsWithNav(), { wrapper: createWrapper(['/home']) })

    act(() => {
      navigateFn('/home')
    })

    expect(performanceReporting.reportNavigation).not.toHaveBeenCalled()
  })

  it('records a new breadcrumb for each subsequent navigation', () => {
    renderHook(() => useNavigationBreadcrumbsWithNav(), { wrapper: createWrapper(['/home']) })

    act(() => {
      navigateFn('/modules')
    })
    act(() => {
      navigateFn('/providers')
    })

    expect(errorReporting.addNavigationBreadcrumb).toHaveBeenNthCalledWith(1, '/home', '/modules')
    expect(errorReporting.addNavigationBreadcrumb).toHaveBeenNthCalledWith(
      2,
      '/modules',
      '/providers',
    )
  })

  it('does not record a breadcrumb when the path is unchanged', () => {
    renderHook(() => useNavigationBreadcrumbsWithNav(), { wrapper: createWrapper(['/home']) })

    act(() => {
      navigateFn('/home')
    })

    expect(errorReporting.addNavigationBreadcrumb).not.toHaveBeenCalled()
  })
})
