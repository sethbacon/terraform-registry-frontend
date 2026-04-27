import { render, act, screen } from '@testing-library/react'
import { HelpProvider, useHelp } from '../HelpContext'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const STORAGE_KEY = 'help-panel-open'

function HelpConsumer() {
  const { helpOpen, openHelp, closeHelp } = useHelp()
  return (
    <div>
      <span data-testid="open">{String(helpOpen)}</span>
      <button onClick={openHelp}>Open</button>
      <button onClick={closeHelp}>Close</button>
    </div>
  )
}

describe('HelpContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('throws when useHelp is used outside HelpProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    function BadConsumer() {
      useHelp()
      return null
    }

    expect(() => render(<BadConsumer />)).toThrow('useHelp must be used within a HelpProvider')
  })

  it('defaults to closed when no localStorage value', () => {
    render(
      <HelpProvider>
        <HelpConsumer />
      </HelpProvider>,
    )

    expect(screen.getByTestId('open').textContent).toBe('false')
  })

  it('restores open state from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'true')

    render(
      <HelpProvider>
        <HelpConsumer />
      </HelpProvider>,
    )

    expect(screen.getByTestId('open').textContent).toBe('true')
  })

  it('openHelp sets helpOpen to true', () => {
    render(
      <HelpProvider>
        <HelpConsumer />
      </HelpProvider>,
    )

    expect(screen.getByTestId('open').textContent).toBe('false')

    act(() => {
      screen.getByText('Open').click()
    })

    expect(screen.getByTestId('open').textContent).toBe('true')
  })

  it('closeHelp sets helpOpen to false', () => {
    localStorage.setItem(STORAGE_KEY, 'true')

    render(
      <HelpProvider>
        <HelpConsumer />
      </HelpProvider>,
    )

    expect(screen.getByTestId('open').textContent).toBe('true')

    act(() => {
      screen.getByText('Close').click()
    })

    expect(screen.getByTestId('open').textContent).toBe('false')
  })

  it('openHelp persists to localStorage', () => {
    render(
      <HelpProvider>
        <HelpConsumer />
      </HelpProvider>,
    )

    act(() => {
      screen.getByText('Open').click()
    })

    expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
  })

  it('closeHelp persists to localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'true')

    render(
      <HelpProvider>
        <HelpConsumer />
      </HelpProvider>,
    )

    act(() => {
      screen.getByText('Close').click()
    })

    expect(localStorage.getItem(STORAGE_KEY)).toBe('false')
  })
})
