import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConsentProvider, useConsent } from '../ConsentContext'

const CONSENT_KEY = 'terraform-registry-consent'

function ConsentConsumer() {
  const { preferences, hasConsented, updatePreferences, acceptAll, rejectAll } = useConsent()
  return (
    <div>
      <span data-testid="consented">{String(hasConsented)}</span>
      <span data-testid="error">{String(preferences.errorReporting)}</span>
      <span data-testid="perf">{String(preferences.performanceReporting)}</span>
      <span data-testid="analytics">{String(preferences.analytics)}</span>
      <button onClick={acceptAll}>Accept All</button>
      <button onClick={rejectAll}>Reject All</button>
      <button onClick={() => updatePreferences({ errorReporting: true })}>Enable Error</button>
      <button onClick={() => updatePreferences({ analytics: true, performanceReporting: true })}>
        Enable Analytics+Perf
      </button>
    </div>
  )
}

describe('ConsentContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('throws when useConsent is used outside ConsentProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function BadConsumer() {
      useConsent()
      return null
    }
    expect(() => render(<BadConsumer />)).toThrow(
      'useConsent must be used within a ConsentProvider',
    )
    spy.mockRestore()
  })

  it('defaults to no consent and all optional prefs disabled', () => {
    render(
      <ConsentProvider>
        <ConsentConsumer />
      </ConsentProvider>,
    )
    expect(screen.getByTestId('consented').textContent).toBe('false')
    expect(screen.getByTestId('error').textContent).toBe('false')
    expect(screen.getByTestId('perf').textContent).toBe('false')
    expect(screen.getByTestId('analytics').textContent).toBe('false')
  })

  it('acceptAll enables all preferences and sets consented', async () => {
    render(
      <ConsentProvider>
        <ConsentConsumer />
      </ConsentProvider>,
    )
    await userEvent.click(screen.getByText('Accept All'))
    expect(screen.getByTestId('consented').textContent).toBe('true')
    expect(screen.getByTestId('error').textContent).toBe('true')
    expect(screen.getByTestId('perf').textContent).toBe('true')
    expect(screen.getByTestId('analytics').textContent).toBe('true')
  })

  it('rejectAll keeps defaults and sets consented', async () => {
    render(
      <ConsentProvider>
        <ConsentConsumer />
      </ConsentProvider>,
    )
    await userEvent.click(screen.getByText('Reject All'))
    expect(screen.getByTestId('consented').textContent).toBe('true')
    expect(screen.getByTestId('error').textContent).toBe('false')
    expect(screen.getByTestId('perf').textContent).toBe('false')
    expect(screen.getByTestId('analytics').textContent).toBe('false')
  })

  it('updatePreferences merges partial updates', async () => {
    render(
      <ConsentProvider>
        <ConsentConsumer />
      </ConsentProvider>,
    )
    await userEvent.click(screen.getByText('Enable Error'))
    expect(screen.getByTestId('consented').textContent).toBe('true')
    expect(screen.getByTestId('error').textContent).toBe('true')
    expect(screen.getByTestId('perf').textContent).toBe('false')
  })

  it('updatePreferences supports multiple fields at once', async () => {
    render(
      <ConsentProvider>
        <ConsentConsumer />
      </ConsentProvider>,
    )
    await userEvent.click(screen.getByText('Enable Analytics+Perf'))
    expect(screen.getByTestId('analytics').textContent).toBe('true')
    expect(screen.getByTestId('perf').textContent).toBe('true')
    expect(screen.getByTestId('error').textContent).toBe('false')
  })

  it('persists preferences to localStorage after consent', async () => {
    render(
      <ConsentProvider>
        <ConsentConsumer />
      </ConsentProvider>,
    )
    await userEvent.click(screen.getByText('Accept All'))
    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY)!)
    expect(stored.errorReporting).toBe(true)
    expect(stored.analytics).toBe(true)
  })

  it('loads saved preferences from localStorage', () => {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({
        essential: true,
        errorReporting: true,
        performanceReporting: false,
        analytics: true,
      }),
    )
    render(
      <ConsentProvider>
        <ConsentConsumer />
      </ConsentProvider>,
    )
    expect(screen.getByTestId('consented').textContent).toBe('true')
    expect(screen.getByTestId('error').textContent).toBe('true')
    expect(screen.getByTestId('analytics').textContent).toBe('true')
    expect(screen.getByTestId('perf').textContent).toBe('false')
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem(CONSENT_KEY, '<<<invalid json>>>')
    render(
      <ConsentProvider>
        <ConsentConsumer />
      </ConsentProvider>,
    )
    expect(screen.getByTestId('consented').textContent).toBe('false')
    expect(screen.getByTestId('error').textContent).toBe('false')
  })
})
