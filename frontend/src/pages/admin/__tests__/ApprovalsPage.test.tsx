import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AxiosError } from 'axios'

const listApprovalRequestsMock = vi.fn()
const createApprovalRequestMock = vi.fn()
const reviewApprovalMock = vi.fn()
vi.mock('../../../services/api', () => ({
  default: {
    listApprovalRequests: (...args: unknown[]) => listApprovalRequestsMock(...args),
    createApprovalRequest: (...args: unknown[]) => createApprovalRequestMock(...args),
    reviewApproval: (...args: unknown[]) => reviewApprovalMock(...args),
    // The organization picker sources a platform admin's options from these.
    // Empty keeps it hidden, so these tests exercise the page's own filtering
    // rather than the picker's (covered in OrganizationFilter.test.tsx).
    listOrganizations: () => Promise.resolve({ organizations: [], hasMore: false, total: 0 }),
    searchOrganizations: () =>
      Promise.resolve({ organizations: [], hasMore: false, total: null }),
  },
}))

let mockAllowedScopes: string[] = ['admin']
// Real per-organization memberships, as useAuth has published since #795. The
// organization filter (#779) sources a non-platform-admin's options from these.
let mockMemberships: Array<{ organization_id: string; organization_name: string }> = []

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    allowedScopes: mockAllowedScopes,
    memberships: mockMemberships,
    user: { id: 'u1' },
  }),
}))

import ApprovalsPage from '../ApprovalsPage'

/**
 * A real AxiosError — getErrorStatus() narrows with `instanceof`, so a
 * duck-typed object would read as status-less and silently take the generic
 * branch, making the 403 guard below pass for the wrong reason.
 */
function axiosFailure(status: number, message: string): AxiosError {
  return new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: 'Error',
    headers: {},
    config: { headers: {} },
    data: { error: message },
  } as never)
}

function renderWithProviders(
  ui: React.ReactElement,
  initialEntries: string[] = ['/admin/approvals'],
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  // The organization filter keeps its selection in the URL (#779), so the page
  // needs a router to render at all.
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  )
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
    mockAllowedScopes = ['admin']
    mockMemberships = []
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
      screen.getByText('Review and manage mirror provider approval requests'),
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
    await waitFor(() =>
      expect(reviewApprovalMock).toHaveBeenCalledWith(
        'apr-1',
        expect.objectContaining({ status: 'approved' }),
      ),
    )
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
    await waitFor(() =>
      expect(reviewApprovalMock).toHaveBeenCalledWith(
        'apr-1',
        expect.objectContaining({ status: 'rejected' }),
      ),
    )
  })

  it('cancels create dialog', async () => {
    listApprovalRequestsMock.mockResolvedValue([])
    const user = userEvent.setup()
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => expect(screen.getByText('Create Request')).toBeInTheDocument())
    await user.click(screen.getByText('Create Request'))
    await waitFor(() => expect(screen.getByText('Create Approval Request')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() =>
      expect(screen.queryByText('Create Approval Request')).not.toBeInTheDocument(),
    )
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

  // ── canManage gates create/approve/reject controls (#609) ──────────────────

  it('hides Create Request and Approve/Reject controls for the mirrors:read scope', async () => {
    mockAllowedScopes = ['mirrors:read']
    listApprovalRequestsMock.mockResolvedValue(fakeApprovals)
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => expect(screen.getByText('hashicorp/aws')).toBeInTheDocument())

    // View access is unaffected — the viewer still sees the approval cards.
    expect(screen.getByText('datadog/datadog')).toBeInTheDocument()
    expect(screen.queryByText('Create Request')).not.toBeInTheDocument()
    expect(screen.queryByText('Approve')).not.toBeInTheDocument()
    expect(screen.queryByText('Reject')).not.toBeInTheDocument()
  })

  it('shows Create Request and Approve/Reject controls for the canonical mirrors:manage scope', async () => {
    mockAllowedScopes = ['mirrors:manage']
    listApprovalRequestsMock.mockResolvedValue(fakeApprovals)
    renderWithProviders(<ApprovalsPage />)
    await waitFor(() => expect(screen.getByText('hashicorp/aws')).toBeInTheDocument())

    expect(screen.getByText('Create Request')).toBeInTheDocument()
    expect(screen.getByText('Approve')).toBeInTheDocument()
    expect(screen.getByText('Reject')).toBeInTheDocument()
  })

  // ── Organization filter (#779) ─────────────────────────────────────────────

  describe('organization filter', () => {
    it('sends no organization when none is selected', async () => {
      listApprovalRequestsMock.mockResolvedValue([])
      renderWithProviders(<ApprovalsPage />)
      await waitFor(() => expect(listApprovalRequestsMock).toHaveBeenCalled())
      expect(listApprovalRequestsMock.mock.calls[0][0]).not.toHaveProperty('organization_id')
    })

    it('narrows the request to the organization named in the URL', async () => {
      listApprovalRequestsMock.mockResolvedValue([])
      renderWithProviders(<ApprovalsPage />, ['/admin/approvals?org=org-2'])
      await waitFor(() =>
        expect(listApprovalRequestsMock).toHaveBeenCalledWith(
          expect.objectContaining({ organization_id: 'org-2' }),
        ),
      )
    })

    // The organization must survive alongside the filters already on the page,
    // rather than replacing them.
    it('keeps the status filter alongside the organization', async () => {
      listApprovalRequestsMock.mockResolvedValue([])
      renderWithProviders(<ApprovalsPage />, ['/admin/approvals?org=org-2'])
      // Wait for the loaded view, not merely the first call: the filter bar
      // lives in the non-loading branch.
      await waitFor(() => {
        expect(screen.getByText('No approval requests found.')).toBeInTheDocument()
      })
      listApprovalRequestsMock.mockClear()

      // The status Select is the only combobox on the page: the organization
      // picker is hidden here (no organizations), which the assertion below
      // relies on and the mock above guarantees.
      await userEvent.click(screen.getByRole('combobox'))
      await userEvent.click(await screen.findByRole('option', { name: 'Pending' }))

      await waitFor(() =>
        expect(listApprovalRequestsMock).toHaveBeenCalledWith({
          status: 'pending',
          organization_id: 'org-2',
        }),
      )
    })

    // ListApprovalRequests answers 403 "Not a member of the requested
    // organization" for an organization the caller holds no mirrors:read in.
    it('reports a 403 as "not a member" rather than a generic load failure', async () => {
      listApprovalRequestsMock.mockRejectedValue(
        axiosFailure(403, 'Not a member of the requested organization'),
      )
      renderWithProviders(<ApprovalsPage />, ['/admin/approvals?org=org-nope'])
      await waitFor(() => {
        expect(screen.getByText(/not a member of that organization/i)).toBeInTheDocument()
      })
    })

    it('still reports a non-403 failure as a load failure', async () => {
      listApprovalRequestsMock.mockRejectedValue(axiosFailure(500, 'database unavailable'))
      renderWithProviders(<ApprovalsPage />, ['/admin/approvals?org=org-2'])
      await waitFor(() => {
        expect(screen.getByText(/database unavailable/i)).toBeInTheDocument()
      })
      expect(screen.queryByText(/not a member of that organization/i)).not.toBeInTheDocument()
    })
  })
})
