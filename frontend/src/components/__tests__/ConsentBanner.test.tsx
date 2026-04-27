import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { ConsentProvider } from '../../contexts/ConsentContext'
import ConsentBanner from '../ConsentBanner'

const CONSENT_KEY = 'terraform-registry-consent'

function renderBanner() {
  return render(
    <ConsentProvider>
      <ConsentBanner />
    </ConsentProvider>,
  )
}

describe('ConsentBanner', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders the banner when user has not consented', () => {
    renderBanner()
    expect(screen.getByRole('dialog', { name: /cookie consent/i })).toBeInTheDocument()
    expect(screen.getByText(/we value your privacy/i)).toBeInTheDocument()
  })

  it('hides when user has already consented', () => {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({
        essential: true,
        errorReporting: false,
        performanceReporting: false,
        analytics: false,
      }),
    )
    renderBanner()
    expect(screen.queryByRole('dialog', { name: /cookie consent/i })).not.toBeInTheDocument()
  })

  it('Accept All sets all preferences and hides banner', async () => {
    renderBanner()
    await userEvent.click(screen.getByText('Accept all'))
    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY)!)
    expect(stored.errorReporting).toBe(true)
    expect(stored.analytics).toBe(true)
    expect(stored.performanceReporting).toBe(true)
  })

  it('Reject All sets defaults and hides banner', async () => {
    renderBanner()
    await userEvent.click(screen.getByText('Reject all'))
    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY)!)
    expect(stored.errorReporting).toBe(false)
    expect(stored.analytics).toBe(false)
  })

  it('Customize shows detail switches', async () => {
    renderBanner()
    expect(screen.queryByLabelText('Error Reporting')).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('Customize'))
    expect(screen.getByLabelText('Error Reporting')).toBeInTheDocument()
    expect(screen.getByLabelText('Performance Monitoring')).toBeInTheDocument()
    expect(screen.getByLabelText('Analytics')).toBeInTheDocument()
  })

  it('toggling a customize switch calls updatePreferences and hides banner', async () => {
    renderBanner()
    await userEvent.click(screen.getByText('Customize'))
    // Error Reporting defaults off; toggle it on — this triggers updatePreferences
    // which sets consented=true and the banner disappears
    await userEvent.click(screen.getByLabelText('Error Reporting'))
    // Banner should now be hidden since updatePreferences sets consented
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // Verify the preference was saved
    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY)!)
    expect(stored.errorReporting).toBe(true)
  })

  it('Hide details button toggles back', async () => {
    renderBanner()
    await userEvent.click(screen.getByText('Customize'))
    expect(screen.getByText('Hide details')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Hide details'))
    expect(screen.queryByLabelText('Error Reporting')).not.toBeInTheDocument()
  })
})
