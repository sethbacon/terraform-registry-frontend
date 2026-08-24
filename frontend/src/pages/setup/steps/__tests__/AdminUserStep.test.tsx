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
    expect(mockCtx.goToStep).toHaveBeenCalledWith(4)
  })

  it('shows spinner when saving', () => {
    mockCtx.adminEmail = 'admin@example.com'
    mockCtx.adminSaving = true
    render(<AdminUserStep />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Configure Admin/i })).toBeDisabled()
  })

  it('calls setAdminEmail on typing', async () => {
    render(<AdminUserStep />)
    const input = screen.getByLabelText(/Admin Email/i)
    await userEvent.setup().type(input, 'a')
    expect(mockCtx.setAdminEmail).toHaveBeenCalled()
  })

  it('navigates forward on Next button click', async () => {
    mockCtx.adminEmail = 'admin@example.com'
    mockCtx.adminSaved = true
    render(<AdminUserStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Next: Complete Setup/i }))
    expect(mockCtx.goToStep).toHaveBeenCalledWith(6)
  })
})

/**
 * The step told the operator the admin would be "added to the default
 * organization with the admin role template". Backend #874 (migration 000054)
 * made both halves false: setup writes only the platform_admins carrier row and
 * deliberately creates no organization membership. The operator was told to
 * expect a state the system no longer creates (#799).
 *
 * Asserting the corrected sentence alone would not catch a revert that re-adds
 * the old one beside it, so the absence of the false claim is asserted too.
 */
describe('AdminUserStep — what it claims about the admin (#799)', () => {
  it('does not promise an organization membership or a role template', () => {
    render(<AdminUserStep />)
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/default organization/i)
    expect(text).not.toMatch(/role template/i)
  })

  it('says the admin is a platform administrator held apart from membership', () => {
    render(<AdminUserStep />)
    expect(screen.getByText(/platform administrator/i)).toBeInTheDocument()
    expect(document.body.textContent ?? '').toMatch(/not added to an organization/i)
  })

  it('resolves every translation key it renders', () => {
    // i18next renders the KEY when a lookup misses, so a typo or a key absent
    // from en/translation.json shows up as "adminUserStep.title" on screen —
    // visible to an operator, invisible to a test that only checks for the
    // strings it expects.
    render(<AdminUserStep />)
    expect(document.body.textContent ?? '').not.toMatch(/adminUserStep\./)
  })
})
