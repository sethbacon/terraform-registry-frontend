import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { ConsentProvider } from '../../contexts/ConsentContext'
import SettingsPage from '../SettingsPage'

const CONSENT_KEY = 'terraform-registry-consent'

function renderSettings() {
  return render(
    <ConsentProvider>
      <SettingsPage />
    </ConsentProvider>,
  )
}

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    // Set initial consent so the page has real state
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({
        essential: true,
        errorReporting: false,
        performanceReporting: false,
        analytics: false,
      }),
    )
  })

  it('renders the settings heading', () => {
    renderSettings()
    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument()
  })

  it('renders telemetry switches', () => {
    renderSettings()
    expect(screen.getByLabelText(/essential cookies/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/error reporting/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/performance monitoring/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/analytics/i)).toBeInTheDocument()
  })

  it('essential cookies switch is disabled', () => {
    renderSettings()
    const essentialSwitch = screen.getByLabelText(/essential cookies/i)
    expect(essentialSwitch).toBeDisabled()
  })

  it('toggling error reporting updates preferences', async () => {
    renderSettings()
    const errorSwitch = screen.getByLabelText(/error reporting/i)
    await userEvent.click(errorSwitch)
    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY)!)
    expect(stored.errorReporting).toBe(true)
  })

  it('toggling performance monitoring updates preferences', async () => {
    renderSettings()
    await userEvent.click(screen.getByLabelText(/performance monitoring/i))
    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY)!)
    expect(stored.performanceReporting).toBe(true)
  })

  it('toggling analytics updates preferences', async () => {
    renderSettings()
    await userEvent.click(screen.getByLabelText(/analytics/i))
    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY)!)
    expect(stored.analytics).toBe(true)
  })
})
