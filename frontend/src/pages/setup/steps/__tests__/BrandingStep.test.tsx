import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

const saveSetupUIThemeMock = vi.fn()
vi.mock('../../../../services/api', () => ({
  default: {
    saveSetupUITheme: (...args: unknown[]) => saveSetupUIThemeMock(...args),
  },
}))

const goToStep = vi.fn()
const setError = vi.fn()
const setSuccess = vi.fn()
vi.mock('../../../../contexts/SetupWizardContext', () => ({
  useSetupWizard: () => ({ goToStep, setError, setSuccess, setupToken: 'test-token' }),
}))

import BrandingStep from '../BrandingStep'
import i18n from '../../../../i18n'

beforeEach(() => {
  vi.clearAllMocks()
  saveSetupUIThemeMock.mockResolvedValue({})
})

afterAll(async () => {
  await i18n.changeLanguage('en')
})

describe('BrandingStep', () => {
  it('offers all seven branding fields', () => {
    render(<BrandingStep />)
    for (const label of [
      'Product Name',
      'Primary Color',
      'Secondary color (light mode)',
      'Secondary color (dark mode)',
      'Logo URL',
      'Favicon URL',
      'Login Page Hero Image URL',
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })

  it('saves through the setup-token route and advances the wizard', async () => {
    const user = userEvent.setup()
    render(<BrandingStep />)

    await user.type(screen.getByLabelText('Product Name'), 'Acme Registry')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(saveSetupUIThemeMock).toHaveBeenCalledWith('test-token', {
        product_name: 'Acme Registry',
      }),
    )
    // Advancing preserves the step's original one-click "Save & Continue", and
    // keeps the card's "reload the page" hint off screen mid-setup.
    await waitFor(() => expect(goToStep).toHaveBeenCalledWith(5))
  })

  it('reports a save failure and stays on the step', async () => {
    saveSetupUIThemeMock.mockRejectedValue(new Error('backend exploded'))
    const user = userEvent.setup()
    render(<BrandingStep />)

    await user.type(screen.getByLabelText('Product Name'), 'Acme Registry')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(setError).toHaveBeenCalled())
    expect(goToStep).not.toHaveBeenCalledWith(5)
  })

  it('rejects a colour the backend would reject, without calling the API', async () => {
    const user = userEvent.setup()
    render(<BrandingStep />)

    await user.type(screen.getByLabelText('Primary Color'), 'rgb(92,78,229)')

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(saveSetupUIThemeMock).not.toHaveBeenCalled()
  })

  it('skips without saving', async () => {
    const user = userEvent.setup()
    render(<BrandingStep />)

    await user.click(screen.getByRole('button', { name: 'Skip' }))

    expect(saveSetupUIThemeMock).not.toHaveBeenCalled()
    expect(goToStep).toHaveBeenCalledWith(5)
  })

  // Regression guard: the card renders a fixed set of fields, and any field the
  // step does not supply copy for silently falls back to the shared package's
  // hardcoded English. That is invisible in `en`, so assert in a translated
  // locale that no field label leaks through untranslated.
  it('translates every field label, including the secondary colours', async () => {
    await i18n.changeLanguage('de')
    render(<BrandingStep />)

    expect(screen.getByLabelText('Sekundärfarbe (Hellmodus)')).toBeInTheDocument()
    expect(screen.getByLabelText('Sekundärfarbe (Dunkelmodus)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Secondary color (light mode)')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Secondary color (dark mode)')).not.toBeInTheDocument()
  })
})
