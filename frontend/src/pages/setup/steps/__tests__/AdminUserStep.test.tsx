import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCtx = {
  adminEmail: '',
  setAdminEmail: vi.fn(),
  adminSaving: false,
  adminSaved: false,
  saveAdmin: vi.fn(),
  goToStep: vi.fn(),
}

vi.mock('../../../../contexts/SetupWizardContext', () => ({
  useSetupWizard: () => mockCtx,
}))

import AdminUserStep from '../AdminUserStep'

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(mockCtx, {
    adminEmail: '',
    adminSaving: false,
    adminSaved: false,
  })
})

describe('AdminUserStep', () => {
  it('renders heading and email input', () => {
    render(<AdminUserStep />)
    expect(screen.getByText('Initial Admin User')).toBeInTheDocument()
    expect(screen.getByLabelText(/Admin Email/i)).toBeInTheDocument()
  })

  it('disables configure button when email is empty', () => {
    render(<AdminUserStep />)
    expect(screen.getByRole('button', { name: /Configure Admin/i })).toBeDisabled()
  })

  it('disables configure button when email has no @', () => {
    mockCtx.adminEmail = 'notanemail'
    render(<AdminUserStep />)
    expect(screen.getByRole('button', { name: /Configure Admin/i })).toBeDisabled()
  })

  it('enables configure button with valid email', () => {
    mockCtx.adminEmail = 'admin@example.com'
    render(<AdminUserStep />)
    expect(screen.getByRole('button', { name: /Configure Admin/i })).toBeEnabled()
  })

  it('calls saveAdmin on button click', async () => {
    mockCtx.adminEmail = 'admin@example.com'
    render(<AdminUserStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Configure Admin/i }))
    expect(mockCtx.saveAdmin).toHaveBeenCalledOnce()
  })

  it('shows Next button when admin is saved', () => {
    mockCtx.adminEmail = 'admin@example.com'
    mockCtx.adminSaved = true
    render(<AdminUserStep />)
    expect(screen.getByRole('button', { name: /Next: Complete Setup/i })).toBeInTheDocument()
  })

  it('does not show Next button before save', () => {
    mockCtx.adminEmail = 'admin@example.com'
    render(<AdminUserStep />)
    expect(screen.queryByRole('button', { name: /Next: Complete Setup/i })).not.toBeInTheDocument()
  })

  it('navigates back on Back button click', async () => {
    render(<AdminUserStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Back/i }))
    expect(mockCtx.goToStep).toHaveBeenCalledWith(3)
  })

  it('shows spinner when saving', () => {
    mockCtx.adminEmail = 'admin@example.com'
    mockCtx.adminSaving = true
    render(<AdminUserStep />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Configure Admin/i })).toBeDisabled()
  })
})
