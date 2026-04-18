import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCtx = {
  setupToken: '',
  setSetupToken: vi.fn(),
  tokenValidating: false,
  tokenValid: false,
  validateToken: vi.fn(),
}

vi.mock('../../../../contexts/SetupWizardContext', () => ({
  useSetupWizard: () => mockCtx,
}))

import AuthenticateStep from '../AuthenticateStep'

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(mockCtx, {
    setupToken: '',
    tokenValidating: false,
    tokenValid: false,
  })
})

describe('AuthenticateStep', () => {
  it('renders the heading and token input', () => {
    render(<AuthenticateStep />)
    expect(screen.getByRole('heading', { name: 'Setup Token' })).toBeInTheDocument()
    expect(screen.getByLabelText('Setup Token')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verify Token' })).toBeInTheDocument()
  })

  it('disables verify button when token is empty', () => {
    render(<AuthenticateStep />)
    expect(screen.getByRole('button', { name: 'Verify Token' })).toBeDisabled()
  })

  it('enables verify button when token has value', () => {
    mockCtx.setupToken = 'tfr_setup_abc'
    render(<AuthenticateStep />)
    expect(screen.getByRole('button', { name: 'Verify Token' })).toBeEnabled()
  })

  it('calls validateToken on button click', async () => {
    mockCtx.setupToken = 'tfr_setup_abc'
    render(<AuthenticateStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Verify Token' }))
    expect(mockCtx.validateToken).toHaveBeenCalledOnce()
  })

  it('disables button and shows spinner when validating', () => {
    mockCtx.setupToken = 'tfr_setup_abc'
    mockCtx.tokenValidating = true
    render(<AuthenticateStep />)
    expect(screen.getByRole('button', { name: '' })).toBeDisabled()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows check icon when token is valid', () => {
    mockCtx.setupToken = 'tfr_setup_abc'
    mockCtx.tokenValid = true
    render(<AuthenticateStep />)
    expect(document.querySelector('[data-testid="CheckCircleIcon"]')).toBeInTheDocument()
  })

  it('calls setSetupToken on input change', async () => {
    render(<AuthenticateStep />)
    await userEvent.setup().type(screen.getByLabelText('Setup Token'), 'x')
    expect(mockCtx.setSetupToken).toHaveBeenCalled()
  })
})
