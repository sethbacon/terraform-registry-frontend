import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const listApprovalRequestsMock = vi.fn()
const createApprovalRequestMock = vi.fn()
const reviewApprovalMock = vi.fn()
vi.mock('../../../services/api', () => ({
  default: {
    listApprovalRequests: (...args: unknown[]) => listApprovalRequestsMock(...args),
    createApprovalRequest: (...args: unknown[]) => createApprovalRequestMock(...args),
    reviewApproval: (...args: unknown[]) => reviewApprovalMock(...args),
  },
}))

import ApprovalsPage from '../ApprovalsPage'

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const fakeApprovals = [
  {
    id: 'apr-1',
    mirror_config_id: 'mirror-1',
    provider_namespace: 'hashicorp',
    provider_name: 'aws',
    reason: 'Need aws provider for production',
    status: 'pending' as const,
    auto_approved: false,
    created_at: '2025-06-01T12:00:00Z',
    updated_at: '2025-06-01T12:00:00Z',
  },
  {
    id: 'apr-2',
    mirror_config_id: 'mirror-2',
    provider_namespace: 'hashicorp',
    provider_name: '',
    status: 'approved' as const,
    auto_approved: true,
    reviewed_at: '2025-06-02T14:00:00Z',
    review_notes: 'Auto-approved per policy',
    created_at: '2025-06-02T12:00:00Z',
    updated_at: '2025-06-02T14:00:00Z',
  },
  {
    id: 'apr-3',
    mirror_config_id: 'mirror-3',
    provider_namespace: 'datadog',
    provider_name: 'datadog',
    status: 'rejected' as const,
    auto_approved: false,
    reviewed_at: '2025-06-03T10:00:00Z',
    created_at: '2025-06-03T08:00:00Z',
    updated_at: '2025-06-03T10:00:00Z',
  },
]

describe('ApprovalsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner while fetching', () => {
    listApprovalRequestsMock.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<ApprovalsPage />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders heading and subheading after load', async () => {
    listApprovalRequestsMock.mockResolvedValue(fakeApprovals)
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => {
      expect(screen.getByText('Approval Requests')).toBeInTheDocument()
    })
    expect(
      screen.getByText('Review and manage mirror provider approval requests')
    ).toBeInTheDocument()
  })

  it('renders approval cards', async () => {
    listApprovalRequestsMock.mockResolvedValue(fakeApprovals)
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => {
      expect(screen.getByText('hashicorp/aws')).toBeInTheDocument()
    })
    expect(screen.getByText('datadog/datadog')).toBeInTheDocument()
  })

  it('shows status chips for all statuses', async () => {
    listApprovalRequestsMock.mockResolvedValue(fakeApprovals)
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => {
      expect(screen.getByText('Pending')).toBeInTheDocument()
    })
    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByText('Rejected')).toBeInTheDocument()
  })

  it('shows reason text on approval card', async () => {
    listApprovalRequestsMock.mockResolvedValue(fakeApprovals)
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => {
      expect(screen.getByText('Need aws provider for production')).toBeInTheDocument()
    })
  })

  it('shows mirror config ID on cards', async () => {
    listApprovalRequestsMock.mockResolvedValue(fakeApprovals)
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => {
      expect(screen.getByText(/mirror-1/)).toBeInTheDocument()
    })
  })

  it('shows review notes for reviewed approvals', async () => {
    listApprovalRequestsMock.mockResolvedValue(fakeApprovals)
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => {
      expect(screen.getByText('Auto-approved per policy')).toBeInTheDocument()
    })
  })

  it('shows Approve and Reject buttons for pending approvals', async () => {
    listApprovalRequestsMock.mockResolvedValue(fakeApprovals)
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument()
    })
    expect(screen.getByText('Reject')).toBeInTheDocument()
  })

  it('shows empty message when no approvals', async () => {
    listApprovalRequestsMock.mockResolvedValue([])
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => {
      expect(screen.getByText('No approval requests found.')).toBeInTheDocument()
    })
  })

  it('shows Create Request and Refresh buttons', async () => {
    listApprovalRequestsMock.mockResolvedValue([])
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => {
      expect(screen.getByText('Create Request')).toBeInTheDocument()
    })
    expect(screen.getByText('Refresh')).toBeInTheDocument()
  })

  it('opens create dialog on Create Request click', async () => {
    listApprovalRequestsMock.mockResolvedValue([])
    const user = userEvent.setup()
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => {
      expect(screen.getByText('Create Request')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Create Request'))
    expect(screen.getByText('Create Approval Request')).toBeInTheDocument()
    expect(screen.getByText('Submit Request')).toBeInTheDocument()
  })

  it('shows reviewed date for reviewed approvals', async () => {
    listApprovalRequestsMock.mockResolvedValue(fakeApprovals)
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => {
      expect(screen.getAllByText(/Reviewed:/).length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders namespace-only display when provider_name empty', async () => {
    listApprovalRequestsMock.mockResolvedValue([
      {
        id: 'apr-ns',
        mirror_config_id: 'mirror-ns',
        provider_namespace: 'customns',
        provider_name: '',
        status: 'pending' as const,
        auto_approved: false,
        created_at: '2025-06-01T00:00:00Z',
        updated_at: '2025-06-01T00:00:00Z',
      },
    ])
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => {
      expect(screen.getByText('customns')).toBeInTheDocument()
    })
  })

  it('creates an approval request via the dialog', async () => {
    listApprovalRequestsMock.mockResolvedValue([])
    createApprovalRequestMock.mockResolvedValue({ id: 'new' })
    const user = userEvent.setup()
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => expect(screen.getByText('Create Request')).toBeInTheDocument())
    await user.click(screen.getByText('Create Request'))
    await waitFor(() => expect(screen.getByText('Create Approval Request')).toBeInTheDocument())
    const textboxes = screen.getAllByRole('textbox')
    await user.type(textboxes[0], 'mirror-xyz')
    await user.type(textboxes[1], 'hashicorp')
    await user.click(screen.getByText('Submit Request'))
    await waitFor(() => expect(createApprovalRequestMock).toHaveBeenCalled())
  })

  it('opens review dialog and approves a pending request', async () => {
    listApprovalRequestsMock.mockResolvedValue(fakeApprovals)
    reviewApprovalMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => expect(screen.getByText('Approve')).toBeInTheDocument())
    await user.click(screen.getByText('Approve'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const dialogBtns = screen.getAllByRole('button', { name: /^approve$/i })
    await user.click(dialogBtns[dialogBtns.length - 1])
    await waitFor(() => expect(reviewApprovalMock).toHaveBeenCalledWith('apr-1', expect.objectContaining({ status: 'approved' })))
  })

  it('opens review dialog and rejects a pending request', async () => {
    listApprovalRequestsMock.mockResolvedValue(fakeApprovals)
    reviewApprovalMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => expect(screen.getByText('Reject')).toBeInTheDocument())
    await user.click(screen.getByText('Reject'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const dialogBtns = screen.getAllByRole('button', { name: /^reject$/i })
    await user.click(dialogBtns[dialogBtns.length - 1])
    await waitFor(() => expect(reviewApprovalMock).toHaveBeenCalledWith('apr-1', expect.objectContaining({ status: 'rejected' })))
  })

  it('cancels create dialog', async () => {
    listApprovalRequestsMock.mockResolvedValue([])
    const user = userEvent.setup()
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => expect(screen.getByText('Create Request')).toBeInTheDocument())
    await user.click(screen.getByText('Create Request'))
    await waitFor(() => expect(screen.getByText('Create Approval Request')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByText('Create Approval Request')).not.toBeInTheDocument())
  })

  it('refresh button re-fetches approvals', async () => {
    listApprovalRequestsMock.mockResolvedValue(fakeApprovals)
    const user = userEvent.setup()
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => expect(screen.getByText('Refresh')).toBeInTheDocument())
    listApprovalRequestsMock.mockClear()
    await user.click(screen.getByText('Refresh'))
    await waitFor(() => expect(listApprovalRequestsMock).toHaveBeenCalled())
  })

  it('shows error alert on API failure', async () => {
    listApprovalRequestsMock.mockRejectedValue(new Error('load failed'))
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => {
      expect(screen.getByText('load failed')).toBeInTheDocument()
    })
  })

  it('shows Auto Approved chip for auto-approved requests', async () => {
    listApprovalRequestsMock.mockResolvedValue(fakeApprovals)
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => expect(screen.getByText(/auto[\s-]*approved/i)).toBeInTheDocument())
  })
})
