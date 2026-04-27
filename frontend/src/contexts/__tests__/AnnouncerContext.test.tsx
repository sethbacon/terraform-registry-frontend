import { render, act, screen } from '@testing-library/react'
import { AnnouncerProvider, useAnnouncer } from '../AnnouncerContext'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

function AnnouncerConsumer() {
  const { announce } = useAnnouncer()
  return (
    <div>
      <button onClick={() => announce('hello polite')}>Polite</button>
      <button onClick={() => announce('urgent thing', 'assertive')}>Assertive</button>
      <button onClick={() => announce('')}>Empty</button>
    </div>
  )
}

describe('AnnouncerContext', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('throws when useAnnouncer is used outside AnnouncerProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    function Bad() {
      useAnnouncer()
      return null
    }
    expect(() => render(<Bad />)).toThrow('useAnnouncer must be used within an AnnouncerProvider')
  })

  it('renders both live regions and they start empty', () => {
    render(
      <AnnouncerProvider>
        <AnnouncerConsumer />
      </AnnouncerProvider>,
    )
    const polite = screen.getByTestId('announcer-polite')
    const assertive = screen.getByTestId('announcer-assertive')
    expect(polite).toHaveAttribute('aria-live', 'polite')
    expect(polite).toHaveAttribute('role', 'status')
    expect(assertive).toHaveAttribute('aria-live', 'assertive')
    expect(assertive).toHaveAttribute('role', 'alert')
    expect(polite.textContent).toBe('')
    expect(assertive.textContent).toBe('')
  })

  it('announces polite messages in the polite region', () => {
    render(
      <AnnouncerProvider>
        <AnnouncerConsumer />
      </AnnouncerProvider>,
    )
    act(() => {
      screen.getByText('Polite').click()
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByTestId('announcer-polite').textContent).toBe('hello polite')
    expect(screen.getByTestId('announcer-assertive').textContent).toBe('')
  })

  it('announces assertive messages in the assertive region', () => {
    render(
      <AnnouncerProvider>
        <AnnouncerConsumer />
      </AnnouncerProvider>,
    )
    act(() => {
      screen.getByText('Assertive').click()
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByTestId('announcer-assertive').textContent).toBe('urgent thing')
    expect(screen.getByTestId('announcer-polite').textContent).toBe('')
  })

  it('clears messages after the configured timeout', () => {
    render(
      <AnnouncerProvider>
        <AnnouncerConsumer />
      </AnnouncerProvider>,
    )
    act(() => {
      screen.getByText('Polite').click()
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByTestId('announcer-polite').textContent).toBe('hello polite')
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByTestId('announcer-polite').textContent).toBe('')
  })

  it('re-announces identical messages by toggling through empty', () => {
    render(
      <AnnouncerProvider>
        <AnnouncerConsumer />
      </AnnouncerProvider>,
    )
    act(() => {
      screen.getByText('Polite').click()
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByTestId('announcer-polite').textContent).toBe('hello polite')

    // Fire the same message again; implementation must clear first then set.
    act(() => {
      screen.getByText('Polite').click()
    })
    // Immediately after click, before the 0-timeout fires, region should be blank.
    expect(screen.getByTestId('announcer-polite').textContent).toBe('')
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByTestId('announcer-polite').textContent).toBe('hello polite')
  })

  it('ignores empty announcements', () => {
    render(
      <AnnouncerProvider>
        <AnnouncerConsumer />
      </AnnouncerProvider>,
    )
    act(() => {
      screen.getByText('Empty').click()
      vi.advanceTimersByTime(10)
    })
    expect(screen.getByTestId('announcer-polite').textContent).toBe('')
    expect(screen.getByTestId('announcer-assertive').textContent).toBe('')
  })
})
