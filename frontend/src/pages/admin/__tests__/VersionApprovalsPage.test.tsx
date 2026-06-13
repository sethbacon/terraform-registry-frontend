import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const listVersionApprovalsMock = vi.fn()
const approveVersionMock = vi.fn()
const rejectVersionMock = vi.fn()
const bulkApproveVersionsMock = vi.fn()
const bulkRejectVersionsMock = vi.fn()
const getVersionApprovalEventsMock = vi.fn()

vi.mock('../../../services/api', () => ({
  default: {
    listVersionApprovals: (...args: unknown[]) => listVersionApprovalsMock(...args),
    approveVersion: (...args: unknown[]) => approveVersionMock(...args),
    rejectVersion: (...args: unknown[]) => rejectVersionMock(...args),
    bulkApproveVersions: (...args: unknown[]) => bulkApproveVersionsMock(...args),
    bulkRejectVersions: (...args: unknown[]) => bulkRejectVersionsMock(...args),
    getVersionApprovalEvents: (...args: unknown[]) => getVersionApprovalEventsMock(...args),
  },
}))

import VersionApprovalsPage from '../VersionApprovalsPage'

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const fakePendingProvider = {
  id: 'mpv-1',
  type: 'provider' as const,
  version: '5.90.0',
  approval_status: 'pending_approval' as const,
  provider_namespace: 'hashicorp',
  provider_name: 'aws',
  mirror_config_name: 'Public Mirror',
  mirror_config_id: 'mc-1',
  gpg_verified: true,
  shasum_verified: true,
  synced_at: '2026-05-29T10:00:00Z',
}

const fakePendingTerraform = {
  id: 'tv-1',
  type: 'terraform' as const,
  version: '1.10.0',
  approval_status: 'pending_approval' as const,
  mirror_config_name: 'Terraform Official',
  mirror_config_id: 'mc-2',
  gpg_verified: false,
  shasum_verified: true,
  synced_at: '2026-05-29T09:00:00Z',
}

const fakeApprovedProvider = {
  ...fakePendingProvider,
  id: 'mpv-2',
  version: '5.89.0',
  approval_status: 'approved' as const,
}

const emptyResponse = { items: [], total: 0 }

beforeEach(() => {
  vi.clearAllMocks()
  listVersionApprovalsMock.mockResolvedValue({
    items: [fakePendingProvider, fakePendingTerraform],
    total: 2,
  })
  getVersionApprovalEventsMock.mockResolvedValue([])
})

describe('VersionApprovalsPage', () => {
  it('shows loading spinner while fetching', () => {
    listVersionApprovalsMock.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<VersionApprovalsPage />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders page title and subtitle after load', async () => {
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => expect(listVersionApprovalsMock).toHaveBeenCalled())
    expect(screen.getByText('Version Approvals')).toBeInTheDocument()
    expect(screen.getByText(/Review and approve mirrored versions/)).toBeInTheDocument()
  })

  it('renders pending versions in table', async () => {
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => expect(screen.getByText('5.90.0')).toBeInTheDocument())
    expect(screen.getByText('1.10.0')).toBeInTheDocument()
  })

  it('displays approval status chips with correct labels', async () => {
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => expect(screen.getAllByText('Pending Approval')).toHaveLength(2))
  })

  it('shows provider namespace/name for provider versions', async () => {
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => expect(screen.getByText('hashicorp/aws')).toBeInTheDocument())
  })

  it('shows terraform chip for terraform versions', async () => {
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => expect(screen.getByText('Terraform')).toBeInTheDocument())
  })

  it('shows mirror config name', async () => {
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => expect(screen.getByText('Public Mirror')).toBeInTheDocument())
    expect(screen.getByText('Terraform Official')).toBeInTheDocument()
  })

  it('displays GPG verified icon for verified versions', async () => {
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => expect(screen.getByTitle('GPG verified')).toBeInTheDocument())
  })

  it('shows approve and reject buttons for pending versions', async () => {
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Approve' })).toHaveLength(2))
    expect(screen.getAllByRole('button', { name: 'Reject' })).toHaveLength(2)
  })

  it('opens approve dialog with notes field on approve click', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => screen.getAllByRole('button', { name: 'Approve' }))
    await user.click(screen.getAllByRole('button', { name: 'Approve' })[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/Notes/i)).toBeInTheDocument()
  })

  it('calls approveVersion API and closes dialog on confirm', async () => {
    approveVersionMock.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => screen.getAllByRole('button', { name: 'Approve' }))
    await user.click(screen.getAllByRole('button', { name: 'Approve' })[0])
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(approveVersionMock).toHaveBeenCalledWith('mpv-1', undefined))
  })

  it('calls approveVersion with notes when notes entered', async () => {
    approveVersionMock.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => screen.getAllByRole('button', { name: 'Approve' }))
    await user.click(screen.getAllByRole('button', { name: 'Approve' })[0])
    await user.type(screen.getByLabelText(/Notes/i), 'Looks good')
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await waitFor(() =>
      expect(approveVersionMock).toHaveBeenCalledWith('mpv-1', { notes: 'Looks good' }),
    )
  })

  it('opens reject dialog on reject click', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => screen.getAllByRole('button', { name: 'Reject' }))
    await user.click(screen.getAllByRole('button', { name: 'Reject' })[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Reject Version')).toBeInTheDocument()
  })

  it('calls rejectVersion API on reject confirm', async () => {
    rejectVersionMock.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => screen.getAllByRole('button', { name: 'Reject' }))
    await user.click(screen.getAllByRole('button', { name: 'Reject' })[0])
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
    await waitFor(() => expect(rejectVersionMock).toHaveBeenCalledWith('mpv-1', undefined))
  })

  it('shows error alert on API failure', async () => {
    approveVersionMock.mockRejectedValue(new Error('Server error'))
    const user = userEvent.setup()
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => screen.getAllByRole('button', { name: 'Approve' }))
    await user.click(screen.getAllByRole('button', { name: 'Approve' })[0])
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  it('shows empty state when no versions', async () => {
    listVersionApprovalsMock.mockResolvedValue(emptyResponse)
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() =>
      expect(screen.getByText('No versions matching this filter')).toBeInTheDocument(),
    )
  })

  it('supports bulk selection via checkboxes', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => screen.getAllByRole('checkbox'))
    const checkboxes = screen.getAllByRole('checkbox')
    // First checkbox is select-all; click second to select one item
    await user.click(checkboxes[1])
    expect(checkboxes[1]).toBeChecked()
  })

  it('enables bulk approve/reject buttons when items selected', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => screen.getAllByRole('checkbox'))
    await user.click(screen.getAllByRole('checkbox')[1])
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Approve Selected/ })).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /Reject Selected/ })).toBeInTheDocument()
  })

  it('calls bulkApproveVersions with selected IDs on confirm', async () => {
    bulkApproveVersionsMock.mockResolvedValue({ approved: 1, failures: [] })
    const user = userEvent.setup()
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => screen.getAllByRole('checkbox'))
    await user.click(screen.getAllByRole('checkbox')[1])
    await user.click(screen.getByRole('button', { name: /Approve Selected/ }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Approve Selected' }))
    await waitFor(() => expect(bulkApproveVersionsMock).toHaveBeenCalledWith(['mpv-1'], undefined))
  })

  it('filters by status tab (approved)', async () => {
    listVersionApprovalsMock.mockResolvedValue({ items: [fakeApprovedProvider], total: 1 })
    const user = userEvent.setup()
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => screen.getByRole('tab', { name: 'Approved' }))
    await user.click(screen.getByRole('tab', { name: 'Approved' }))
    await waitFor(() =>
      expect(listVersionApprovalsMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' }),
      ),
    )
  })

  it('selects all with select-all checkbox', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => screen.getAllByRole('checkbox'))
    await user.click(screen.getAllByRole('checkbox')[0])
    const rowCheckboxes = screen.getAllByRole('checkbox').slice(1)
    rowCheckboxes.forEach((cb) => expect(cb).toBeChecked())
  })

  it('shows success alert after approving', async () => {
    approveVersionMock.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => screen.getAllByRole('button', { name: 'Approve' }))
    await user.click(screen.getAllByRole('button', { name: 'Approve' })[0])
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(screen.getByText('Version approved')).toBeInTheDocument())
  })

  it('expands a row to load and render the audit trail', async () => {
    getVersionApprovalEventsMock.mockResolvedValue([
      {
        id: 'ev-1',
        action: 'auto_approved',
        performed_by_name: 'alice',
        notes: 'matched rule',
        auto_approve_rule: 'gpg_verified',
        created_at: '2026-05-29T11:00:00Z',
      },
    ])
    const user = userEvent.setup()
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => screen.getAllByRole('button', { name: /expand row/i }))
    await user.click(screen.getAllByRole('button', { name: /expand row/i })[0])
    await waitFor(() => expect(getVersionApprovalEventsMock).toHaveBeenCalledWith('mpv-1'))
    expect(await screen.findByText(/auto_approved/)).toBeInTheDocument()
    expect(screen.getByText(/alice/)).toBeInTheDocument()
  })

  it('shows empty audit trail message when a row has no events', async () => {
    getVersionApprovalEventsMock.mockResolvedValue([])
    const user = userEvent.setup()
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => screen.getAllByRole('button', { name: /expand row/i }))
    await user.click(screen.getAllByRole('button', { name: /expand row/i })[0])
    expect(await screen.findByText(/No approval events/i)).toBeInTheDocument()
  })

  it('filters by provider type via the type toggle', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => screen.getByRole('button', { name: 'Provider Versions' }))
    await user.click(screen.getByRole('button', { name: 'Provider Versions' }))
    await waitFor(() =>
      expect(listVersionApprovalsMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'provider' }),
      ),
    )
  })

  it('calls bulkRejectVersions with selected IDs on confirm', async () => {
    bulkRejectVersionsMock.mockResolvedValue({ rejected: 1, failures: [] })
    const user = userEvent.setup()
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => screen.getAllByRole('checkbox'))
    await user.click(screen.getAllByRole('checkbox')[1])
    await user.click(screen.getByRole('button', { name: /Reject Selected/ }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Reject Selected' }))
    await waitFor(() => expect(bulkRejectVersionsMock).toHaveBeenCalledWith(['mpv-1'], undefined))
  })

  it('shows error alert when listing fails', async () => {
    listVersionApprovalsMock.mockRejectedValue(new Error('boom'))
    renderWithProviders(<VersionApprovalsPage />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})
