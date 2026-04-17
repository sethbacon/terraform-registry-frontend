import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// --- Mocks (must be before component import) ---

const listAPIKeysMock = vi.fn()
const createAPIKeyMock = vi.fn()
const updateAPIKeyMock = vi.fn()
const deleteAPIKeyMock = vi.fn()
const rotateAPIKeyMock = vi.fn()
const getCurrentUserMembershipsMock = vi.fn()

vi.mock('../../../services/api', () => ({
  default: {
    listAPIKeys: (...args: unknown[]) => listAPIKeysMock(...args),
    createAPIKey: (...args: unknown[]) => createAPIKeyMock(...args),
    updateAPIKey: (...args: unknown[]) => updateAPIKeyMock(...args),
    deleteAPIKey: (...args: unknown[]) => deleteAPIKeyMock(...args),
    rotateAPIKey: (...args: unknown[]) => rotateAPIKeyMock(...args),
    getCurrentUserMemberships: (...args: unknown[]) => getCurrentUserMembershipsMock(...args),
  },
}))

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    allowedScopes: ['admin'],
    roleTemplate: { display_name: 'Administrator' },
    user: { id: 'user-1' },
  }),
}))

import APIKeysPage from '../APIKeysPage'

// --- Helpers ---

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
}

function renderPage() {
  const qc = createQueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <APIKeysPage />
    </QueryClientProvider>
  )
}

const fakeMemberships = [
  {
    organization_id: 'org-1',
    organization_name: 'Acme Corp',
    role_template_display_name: 'Admin',
  },
]

const fakeKeys = [
  {
    id: 'key-1',
    user_id: 'user-1',
    organization_id: 'org-1',
    name: 'CI Pipeline Key',
    description: 'Used in GitHub Actions',
    key_prefix: 'tfr_abc123xyz789',
    scopes: ['modules:read', 'providers:read'],
    expires_at: '2099-12-31T23:59:59Z',
    last_used_at: '2026-04-10T08:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'key-2',
    user_id: 'user-1',
    organization_id: 'org-1',
    name: 'Expired Key',
    description: '',
    key_prefix: 'tfr_expired0000',
    scopes: ['modules:read'],
    expires_at: '2020-01-01T00:00:00Z',
    last_used_at: null,
    created_at: '2019-06-01T00:00:00Z',
  },
  {
    id: 'key-3',
    user_id: 'user-1',
    organization_id: 'org-1',
    name: 'No Expiry Key',
    description: '',
    key_prefix: 'tfr_noexpiry000',
    scopes: ['admin', 'modules:write', 'providers:write'],
    expires_at: null,
    last_used_at: null,
    created_at: '2026-03-15T00:00:00Z',
  },
]

describe('APIKeysPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCurrentUserMembershipsMock.mockResolvedValue(fakeMemberships)
  })

  // 1. Loading state
  it('shows a loading spinner while API keys are being fetched', () => {
    listAPIKeysMock.mockReturnValue(new Promise(() => { }))
    renderPage()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  // 2. Heading and subheading
  it('renders the page heading and description', async () => {
    listAPIKeysMock.mockResolvedValue(fakeKeys)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument()
    })
    expect(screen.getByText('Manage API keys for Terraform CLI authentication')).toBeInTheDocument()
  })

  // 3. Table with API keys
  it('renders a table with API key rows after loading', async () => {
    listAPIKeysMock.mockResolvedValue(fakeKeys)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('CI Pipeline Key')).toBeInTheDocument()
    })
    expect(screen.getByText('Expired Key')).toBeInTheDocument()
    expect(screen.getByText('No Expiry Key')).toBeInTheDocument()
    // Check key tail display (last 6 chars prefixed with ...)
    expect(screen.getByText('...xyz789')).toBeInTheDocument()
    // Verify description is shown
    expect(screen.getByText('Used in GitHub Actions')).toBeInTheDocument()
  })

  // 4. Empty state
  it('shows empty state message when no API keys exist', async () => {
    listAPIKeysMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('No API keys yet')).toBeInTheDocument()
    })
    expect(screen.getByTestId('apikeys-empty-state-primary')).toHaveTextContent('Create API key')
  })

  // 5. Expiration chip: expired
  it('displays an Expired chip for keys past their expiration', async () => {
    listAPIKeysMock.mockResolvedValue([fakeKeys[1]])
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Expired')).toBeInTheDocument()
    })
  })

  // 6. Expiration chip: never (key-3 has null expires_at AND null last_used_at,
  //    so "Never" appears both for expiration column and last-used column)
  it('displays Never for keys with no expiration date', async () => {
    listAPIKeysMock.mockResolvedValue([fakeKeys[2]])
    renderPage()
    await waitFor(() => {
      const neverElements = screen.getAllByText('Never')
      expect(neverElements.length).toBeGreaterThanOrEqual(1)
    })
  })

  // 7. Scope chips rendering with overflow
  it('shows scope chips and overflow badge for keys with many scopes', async () => {
    listAPIKeysMock.mockResolvedValue([fakeKeys[2]])
    renderPage()
    // key-3 has 3 scopes, max visible is 2, so should show +1
    await waitFor(() => {
      expect(screen.getByText('+1')).toBeInTheDocument()
    })
  })

  // 8. Open create dialog
  it('opens the Create API Key dialog when the button is clicked', async () => {
    listAPIKeysMock.mockResolvedValue([])
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Create API Key/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /Create API Key/i }))
    const dialog = screen.getByRole('dialog')
    // Dialog title
    expect(within(dialog).getByText('Create API Key')).toBeInTheDocument()
    // Dialog form fields present
    expect(within(dialog).getByLabelText(/Name/)).toBeInTheDocument()
    expect(within(dialog).getByText('Scopes')).toBeInTheDocument()
  })

  // 9. Create button disabled when form is empty
  it('disables the Create button when no name or scopes are provided', async () => {
    listAPIKeysMock.mockResolvedValue([])
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Create API Key/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /Create API Key/i }))
    const dialog = screen.getByRole('dialog')
    const createBtn = within(dialog).getByRole('button', { name: 'Create' })
    // Name is empty so Create should be disabled
    expect(createBtn).toBeDisabled()
  })

  // 10. Successful key creation shows the new key value
  it('shows the newly created key and copy button after successful creation', async () => {
    listAPIKeysMock.mockResolvedValue([])
    createAPIKeyMock.mockResolvedValue({ key: 'tfr_newsecretkey12345' })
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Create API Key/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /Create API Key/i }))
    const dialog = screen.getByRole('dialog')
    // Fill in name
    const nameInput = within(dialog).getByLabelText(/Name/)
    await user.type(nameInput, 'My New Key')
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))
    await waitFor(() => {
      expect(screen.getByText(/API key created successfully/)).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue('tfr_newsecretkey12345')).toBeInTheDocument()
    // Copy button exists
    expect(screen.getByRole('button', { name: /Copy API key/ })).toBeInTheDocument()
  })

  // 11. Copy key to clipboard - verify UI feedback after copy button click
  it('shows Copied to clipboard feedback when copy button is clicked', async () => {
    listAPIKeysMock.mockResolvedValue([])
    createAPIKeyMock.mockResolvedValue({ key: 'tfr_copyme123' })
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Create API Key/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /Create API Key/i }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/Name/), 'Copy Test')
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))
    await waitFor(() => {
      expect(screen.getByDisplayValue('tfr_copyme123')).toBeInTheDocument()
    })
    // The copy button with its aria-label should be present
    const copyBtn = screen.getByRole('button', { name: /Copy API key/ })
    expect(copyBtn).toBeInTheDocument()
    await user.click(copyBtn)
    await waitFor(() => {
      expect(screen.getByText('Copied to clipboard!')).toBeInTheDocument()
    })
  })

  // 12. Delete confirmation dialog
  it('opens delete confirmation dialog and deletes the key', async () => {
    listAPIKeysMock.mockResolvedValue([fakeKeys[0]])
    deleteAPIKeyMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('CI Pipeline Key')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /Delete API key/ }))
    expect(screen.getByText(/Are you sure you want to delete API key/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(deleteAPIKeyMock).toHaveBeenCalledWith('key-1')
    })
  })

  // 13. Edit dialog opens with pre-filled data
  it('opens the edit dialog with pre-filled values when Edit is clicked', async () => {
    listAPIKeysMock.mockResolvedValue([fakeKeys[0]])
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('CI Pipeline Key')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /Edit API key/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Edit API Key')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('CI Pipeline Key')).toBeInTheDocument()
    // Save and Cancel buttons should be visible
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  // 14. Edit dialog save
  it('calls updateAPIKey when Save is clicked in the edit dialog', async () => {
    listAPIKeysMock.mockResolvedValue([fakeKeys[0]])
    updateAPIKeyMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('CI Pipeline Key')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /Edit API key/ }))
    const dialog = screen.getByRole('dialog')
    const nameInput = within(dialog).getByDisplayValue('CI Pipeline Key')
    await user.clear(nameInput)
    await user.type(nameInput, 'Renamed Key')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(updateAPIKeyMock).toHaveBeenCalledWith('key-1', expect.objectContaining({ name: 'Renamed Key' }))
    })
  })

  // 15. Rotate dialog opens and can rotate immediately
  it('opens the rotate dialog and performs immediate rotation', async () => {
    listAPIKeysMock.mockResolvedValue([fakeKeys[0]])
    rotateAPIKeyMock.mockResolvedValue({
      new_key: { key: 'tfr_rotated999' },
      old_key_status: 'revoked',
    })
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('CI Pipeline Key')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /Rotate API key/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Rotate API Key')).toBeInTheDocument()
    expect(within(dialog).getByText(/Rotating key/)).toBeInTheDocument()
    // Default is "Revoke old key immediately"
    expect(within(dialog).getByLabelText(/Revoke old key immediately/)).toBeChecked()
    await user.click(within(dialog).getByRole('button', { name: 'Rotate Key' }))
    await waitFor(() => {
      expect(rotateAPIKeyMock).toHaveBeenCalledWith('key-1', 0)
    })
    await waitFor(() => {
      expect(screen.getByText(/Key rotated successfully/)).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue('tfr_rotated999')).toBeInTheDocument()
    // Old key revoked message
    expect(screen.getByText(/old key has been revoked immediately/)).toBeInTheDocument()
  })

  // 16. Rotate with grace period
  it('shows grace period slider when grace period option is selected', async () => {
    listAPIKeysMock.mockResolvedValue([fakeKeys[0]])
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('CI Pipeline Key')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /Rotate API key/ }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByLabelText(/Keep old key valid for a grace period/))
    expect(within(dialog).getByText(/Grace period: 24 hours/)).toBeInTheDocument()
    expect(within(dialog).getByRole('slider')).toBeInTheDocument()
  })

  // 17. Error alert for create failure
  // getErrorMessage returns the Error.message for plain Errors, so we assert on that
  it('shows an error alert when API key creation fails', async () => {
    listAPIKeysMock.mockResolvedValue([])
    createAPIKeyMock.mockRejectedValue(new Error('Server error'))
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Create API Key/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /Create API Key/i }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/Name/), 'Fail Key')
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
  })

  // 18. Usage instructions section
  it('shows the usage instructions section with terraformrc example', async () => {
    listAPIKeysMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Using API Keys')).toBeInTheDocument()
    })
    expect(screen.getByText(/To use an API key with Terraform CLI/)).toBeInTheDocument()
    expect(screen.getByText(/\.terraformrc/)).toBeInTheDocument()
  })

  // 19. No organization membership warning
  it('shows a warning when the user has no organization memberships', async () => {
    getCurrentUserMembershipsMock.mockResolvedValue([])
    listAPIKeysMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => {
      expect(
        screen.getByText(/not a member of any organization/)
      ).toBeInTheDocument()
    })
  })

  // 20. Last used column shows Never when not used
  it('shows Never for last used when key has not been used', async () => {
    listAPIKeysMock.mockResolvedValue([fakeKeys[2]])
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('No Expiry Key')).toBeInTheDocument()
    })
    // "Never" appears both for expiration and last used; check multiple
    const neverTexts = screen.getAllByText('Never')
    expect(neverTexts.length).toBeGreaterThanOrEqual(2)
  })
})
