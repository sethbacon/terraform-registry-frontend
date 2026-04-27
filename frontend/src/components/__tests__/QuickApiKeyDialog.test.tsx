import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const createAPIKeyMock = vi.fn()
vi.mock('../../services/api', () => ({
  default: {
    createAPIKey: (...args: unknown[]) => createAPIKeyMock(...args),
  },
}))

const announceMock = vi.fn()
vi.mock('../../contexts/AnnouncerContext', () => ({
  useAnnouncer: () => ({ announce: announceMock }),
}))

import QuickApiKeyDialog from '../QuickApiKeyDialog'

function renderDialog(props: Partial<React.ComponentProps<typeof QuickApiKeyDialog>> = {}) {
  const onClose = props.onClose ?? vi.fn()
  const organizationId =
    'organizationId' in props ? (props.organizationId as string | null) : 'org-1'
  return {
    onClose,
    ...render(
      <QuickApiKeyDialog
        open={props.open ?? true}
        onClose={onClose}
        organizationId={organizationId}
        hostname={props.hostname ?? 'registry.example.com'}
        defaultScopes={props.defaultScopes}
      />,
    ),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('QuickApiKeyDialog', () => {
  it('renders closed by default when open is false', () => {
    renderDialog({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('blocks submit when name is empty', async () => {
    renderDialog()
    const create = screen.getByRole('button', { name: /^Create$/ })
    expect(create).toBeDisabled()
  })

  it('warns when no organization is available and disables submit', () => {
    renderDialog({ organizationId: null })
    expect(screen.getByText(/You must be a member of an organization/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Create$/ })).toBeDisabled()
  })

  it('shows expiry preset dropdown with 4 options', async () => {
    renderDialog()
    const select = screen.getByTestId('quick-apikey-expiry')
    // MUI Select uses a hidden input; open via combobox
    await userEvent.click(screen.getByRole('combobox', { name: /Expires in/i }))
    expect(await screen.findByRole('option', { name: '7 days' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '30 days' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '90 days' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Never' })).toBeInTheDocument()
    expect(select).toBeInTheDocument()
  })

  it('calls api.createAPIKey on submit and shows the snippet with the token', async () => {
    createAPIKeyMock.mockResolvedValue({ key: 'super-secret-token' })
    renderDialog()
    await userEvent.type(screen.getByLabelText(/API key name/i), 'My CI key')
    await userEvent.click(screen.getByRole('button', { name: /^Create$/ }))
    await waitFor(() => expect(createAPIKeyMock).toHaveBeenCalled())
    const callArgs = createAPIKeyMock.mock.calls[0][0]
    expect(callArgs.name).toBe('My CI key')
    expect(callArgs.organization_id).toBe('org-1')
    expect(callArgs.scopes).toEqual(['modules:read', 'providers:read'])
    // Snippet shown with real token
    const snippet = await screen.findByTestId('quick-apikey-snippet')
    expect(snippet.textContent).toContain('super-secret-token')
    expect(snippet.textContent).toContain('registry.example.com')
  })

  it('shows an Alert when createAPIKey rejects', async () => {
    createAPIKeyMock.mockRejectedValue(new Error('boom'))
    renderDialog()
    await userEvent.type(screen.getByLabelText(/API key name/i), 'will fail')
    await userEvent.click(screen.getByRole('button', { name: /^Create$/ }))
    expect(await screen.findByText(/boom/i)).toBeInTheDocument()
    expect(screen.queryByTestId('quick-apikey-snippet')).not.toBeInTheDocument()
  })

  it('announces after copying the snippet', async () => {
    createAPIKeyMock.mockResolvedValue({ key: 'tok-123' })
    // jsdom does not provide navigator.clipboard by default
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderDialog()
    await userEvent.type(screen.getByLabelText(/API key name/i), 'k')
    await userEvent.click(screen.getByRole('button', { name: /^Create$/ }))
    const copyBtn = await screen.findByLabelText(/Copy credentials snippet/i)
    await userEvent.click(copyBtn)
    await waitFor(() => expect(writeText).toHaveBeenCalled())
    expect(writeText.mock.calls[0][0]).toContain('tok-123')
    expect(announceMock).toHaveBeenCalledWith('API key credentials copied to clipboard')
  })

  it('prompts for confirmation when closing after token generation without copying', async () => {
    createAPIKeyMock.mockResolvedValue({ key: 'tok-xyz' })
    const onClose = vi.fn()
    render(<QuickApiKeyDialog open={true} onClose={onClose} organizationId="org-1" hostname="h" />)
    await userEvent.type(screen.getByLabelText(/API key name/i), 'k')
    await userEvent.click(screen.getByRole('button', { name: /^Create$/ }))
    await screen.findByTestId('quick-apikey-snippet')
    // "Done" button closes — first click should show confirm, not close.
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getByTestId('quick-apikey-confirm-close')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    // "Close without copying" finishes the close.
    await userEvent.click(screen.getByRole('button', { name: /Close without copying/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
