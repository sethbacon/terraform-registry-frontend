import { renderHook, act } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useRouteFocus } from '../useRouteFocus'
import { AnnouncerProvider } from '../../contexts/AnnouncerContext'
import type { ReactNode } from 'react'

/** Helper that calls useRouteFocus AND exposes navigate so tests can trigger route changes. */
let navigateFn: ReturnType<typeof useNavigate>
function useRouteFocusWithNav() {
  navigateFn = useNavigate()
  useRouteFocus()
}

function createWrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <AnnouncerProvider>{children}</AnnouncerProvider>
      </MemoryRouter>
    )
  }
}

describe('useRouteFocus', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.title = 'Test Page'
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('does not move focus on initial render', () => {
    const h1 = document.createElement('h1')
    h1.textContent = 'Home'
    document.body.appendChild(h1)
    const focusSpy = vi.spyOn(h1, 'focus')

    renderHook(() => useRouteFocusWithNav(), { wrapper: createWrapper(['/']) })

    vi.advanceTimersByTime(200)
    expect(focusSpy).not.toHaveBeenCalled()
  })

  it('focuses h1 and announces on route change', () => {
    const h1 = document.createElement('h1')
    h1.textContent = 'Page Title'
    document.body.appendChild(h1)
    const focusSpy = vi.spyOn(h1, 'focus')

    renderHook(() => useRouteFocusWithNav(), {
      wrapper: createWrapper(['/']),
    })

    // Navigate to trigger the effect
    act(() => {
      navigateFn('/other')
    })
    vi.advanceTimersByTime(200)

    expect(focusSpy).toHaveBeenCalled()
  })

  it('sets tabindex=-1 on h1 and removes on blur', () => {
    const h1 = document.createElement('h1')
    h1.textContent = 'Heading'
    document.body.appendChild(h1)

    renderHook(() => useRouteFocusWithNav(), {
      wrapper: createWrapper(['/']),
    })

    act(() => {
      navigateFn('/next')
    })
    vi.advanceTimersByTime(200)

    expect(h1.getAttribute('tabindex')).toBe('-1')
    // Simulate blur to verify the one-time listener removes tabindex
    h1.dispatchEvent(new Event('blur'))
    expect(h1.hasAttribute('tabindex')).toBe(false)
  })

  it('skips tabindex when element already has one', () => {
    const h1 = document.createElement('h1')
    h1.textContent = 'Heading'
    h1.setAttribute('tabindex', '0')
    document.body.appendChild(h1)

    renderHook(() => useRouteFocusWithNav(), {
      wrapper: createWrapper(['/']),
    })

    act(() => {
      navigateFn('/page2')
    })
    vi.advanceTimersByTime(200)

    expect(h1.getAttribute('tabindex')).toBe('0')
  })

  it('falls back to main when no h1 exists', () => {
    const main = document.createElement('main')
    document.body.appendChild(main)
    const focusSpy = vi.spyOn(main, 'focus')

    renderHook(() => useRouteFocusWithNav(), {
      wrapper: createWrapper(['/']),
    })

    act(() => {
      navigateFn('/other')
    })
    vi.advanceTimersByTime(200)

    expect(focusSpy).toHaveBeenCalled()
    expect(main.getAttribute('tabindex')).toBe('-1')
  })

  it('does not focus when neither h1 nor main exists', () => {
    renderHook(() => useRouteFocusWithNav(), {
      wrapper: createWrapper(['/']),
    })

    // Should not throw
    act(() => {
      navigateFn('/empty')
    })
    vi.advanceTimersByTime(200)
  })

  it('announces page title from document.title', () => {
    const h1 = document.createElement('h1')
    h1.textContent = 'Heading'
    document.body.appendChild(h1)
    document.title = 'My Page'

    renderHook(() => useRouteFocusWithNav(), {
      wrapper: createWrapper(['/']),
    })

    act(() => {
      navigateFn('/new')
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })

    // The announcer live region should contain the announcement
    const polite = document.querySelector('[aria-live="polite"]')
    expect(polite?.textContent).toContain('Navigated to My Page')
  })

  it('announces heading text when document.title is empty', () => {
    const h1 = document.createElement('h1')
    h1.textContent = 'Dashboard'
    document.body.appendChild(h1)
    document.title = ''

    renderHook(() => useRouteFocusWithNav(), {
      wrapper: createWrapper(['/']),
    })

    act(() => {
      navigateFn('/dash')
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })

    const polite = document.querySelector('[aria-live="polite"]')
    expect(polite?.textContent).toContain('Navigated to Dashboard')
  })
})
