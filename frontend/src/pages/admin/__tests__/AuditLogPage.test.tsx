import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'

// ---- Mocks ----

const listAuditLogsMock = vi.fn()
const exportCsvMock = vi.fn()
const exportJsonMock = vi.fn()
vi.mock('../../../services/api', () => ({
  default: {
    listAuditLogs: (...args: unknown[]) => listAuditLogsMock(...args),
    exportAuditLogsCSV: (...args: unknown[]) => exportCsvMock(...args),
    exportAuditLogsJSON: (...args: unknown[]) => exportJsonMock(...args),
  },
}))

// The organization filter's options are the caller's real memberships from
// /auth/me (#795). Mutable so each test can choose the membership set.
const authState = vi.hoisted(() => ({
  memberships: [] as Array<{ organization_id: string; organization_name: string }>,
}))
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => authState }))

import AuditLogPage from '../../admin/AuditLogPage'

// ---- Helpers ----

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
}

function renderPage() {
  const queryClient = createQueryClient()
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuditLogPage />
      </QueryClientProvider>,
    ),
  }
}

const MEMBERSHIPS = [
  { organization_id: 'org-a', organization_name: 'acme' },
  { organization_id: 'org-b', organization_name: 'beta' },
]

/** Pick out only the filter-bearing keys of a listAuditLogs call. */
const FILTER_KEYS = [
  'resource_type',
  'action',
  'user_email',
  'start_date',
  'end_date',
  'organization_id',
] as const
function filtersOf(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(FILTER_KEYS.filter((k) => k in params).map((k) => [k, params[k]]))
}

/**
 * A real AxiosError — getErrorStatus() narrows with `instanceof`, so a
 * duck-typed object would read as status-less and silently take the generic
 * branch, making the 403 guard below pass for the wrong reason.
 */
function forbidden(): AxiosError {
  return new AxiosError(
    'Request failed with status code 403',
    'ERR_BAD_REQUEST',
    undefined,
    undefined,
    {
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      config: { headers: {} },
      data: { error: 'Not a member of the requested organization' },
    } as never,
  )
}

async function selectOrganization(name: string) {
  await userEvent.click(screen.getByLabelText('Organization'))
  await userEvent.click(screen.getByRole('option', { name }))
}

// ---- Mock data ----

const fakeLogs = {
  logs: [
    {
      id: 'log-1',
      created_at: '2025-06-01T12:00:00Z',
      action: 'POST /api/v1/modules',
      resource_type: 'module',
      resource_id: 'm-1',
      user_email: 'admin@example.com',
      user_name: 'Admin',
      ip_address: '192.168.1.1',
    },
    {
      id: 'log-2',
      created_at: '2025-06-02T14:00:00Z',
      action: 'DELETE /api/v1/users/u1',
      resource_type: 'user',
      resource_id: 'u-1',
      user_email: 'admin@example.com',
      ip_address: '10.0.0.1',
    },
  ],
  pagination: { total: 2, page: 1, per_page: 25 },
}

// ---- Tests ----

describe('AuditLogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.memberships = []
  })

  it('shows loading spinner while fetching', () => {
    listAuditLogsMock.mockReturnValue(new Promise(() => { }))
    renderPage()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders heading "Audit Logs"', () => {
    listAuditLogsMock.mockReturnValue(new Promise(() => { }))
    renderPage()
    expect(screen.getByText('Audit Logs')).toBeInTheDocument()
  })

  it('renders table with log entries', async () => {
    listAuditLogsMock.mockResolvedValue(fakeLogs)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('POST /api/v1/modules')).toBeInTheDocument()
    })
    expect(screen.getByText('DELETE /api/v1/users/u1')).toBeInTheDocument()
    expect(screen.getAllByText('admin@example.com').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('192.168.1.1')).toBeInTheDocument()
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument()
  })

  it('shows filter controls', () => {
    listAuditLogsMock.mockReturnValue(new Promise(() => { }))
    renderPage()
    expect(screen.getByLabelText('Resource Type')).toBeInTheDocument()
    expect(screen.getByLabelText('Action')).toBeInTheDocument()
    expect(screen.getByText('Reset')).toBeInTheDocument()
  })

  it('shows Export button', () => {
    listAuditLogsMock.mockReturnValue(new Promise(() => { }))
    renderPage()
    expect(screen.getByText('Export')).toBeInTheDocument()
  })

  it('shows empty state when no logs', async () => {
    listAuditLogsMock.mockResolvedValue({
      logs: [],
      pagination: { total: 0, page: 1, per_page: 25 },
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('No audit entries match the current filters')).toBeInTheDocument()
    })
  })

  it('shows pagination controls', async () => {
    listAuditLogsMock.mockResolvedValue(fakeLogs)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('POST /api/v1/modules')).toBeInTheDocument()
    })
    // MUI TablePagination renders "Rows per page:" text
    expect(screen.getByText('Rows per page:')).toBeInTheDocument()
  })

  it('opens detail dialog when a row is clicked', async () => {
    listAuditLogsMock.mockResolvedValue(fakeLogs)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('POST /api/v1/modules')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('POST /api/v1/modules'))
    expect(screen.getByText('Audit Log Detail')).toBeInTheDocument()
    expect(screen.getAllByText(/log-1/).length).toBeGreaterThan(0)
  })

  it('closes detail dialog via Close button', async () => {
    listAuditLogsMock.mockResolvedValue(fakeLogs)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('POST /api/v1/modules')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('POST /api/v1/modules'))
    await userEvent.click(screen.getByRole('button', { name: /^close$/i }))
    await waitFor(() => {
      expect(screen.queryByText('Audit Log Detail')).not.toBeInTheDocument()
    })
  })

  it('renders metadata when present in selected log', async () => {
    const logsWithMeta = {
      logs: [
        {
          id: 'log-x',
          created_at: '2025-06-01T12:00:00Z',
          action: 'UPDATE',
          resource_type: 'mirror',
          resource_id: 'mir-1',
          user_email: 'someone@ex.com',
          metadata: { reason: 'config change' },
        },
      ],
      pagination: { total: 1, page: 1, per_page: 25 },
    }
    listAuditLogsMock.mockResolvedValue(logsWithMeta)
    renderPage()
    await waitFor(() => expect(screen.getByText('UPDATE')).toBeInTheDocument())
    await userEvent.click(screen.getByText('UPDATE'))
    expect(screen.getByText(/Metadata/)).toBeInTheDocument()
    expect(screen.getByText(/config change/)).toBeInTheDocument()
  })

  it('clicking Export opens the menu with CSV and JSON options', async () => {
    listAuditLogsMock.mockResolvedValue(fakeLogs)
    renderPage()
    await waitFor(() => expect(screen.getByText('POST /api/v1/modules')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /export/i }))
    expect(screen.getByText('Export as CSV')).toBeInTheDocument()
    expect(screen.getByText('Export as JSON')).toBeInTheDocument()
  })

  it('exports as CSV when the CSV menu item is clicked', async () => {
    listAuditLogsMock.mockResolvedValue(fakeLogs)
    renderPage()
    await waitFor(() => expect(screen.getByText('POST /api/v1/modules')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /export/i }))
    await userEvent.click(screen.getByText('Export as CSV'))
    await waitFor(() => expect(exportCsvMock).toHaveBeenCalled())
  })

  it('exports as JSON when the JSON menu item is clicked', async () => {
    listAuditLogsMock.mockResolvedValue(fakeLogs)
    renderPage()
    await waitFor(() => expect(screen.getByText('POST /api/v1/modules')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /export/i }))
    await userEvent.click(screen.getByText('Export as JSON'))
    await waitFor(() => expect(exportJsonMock).toHaveBeenCalled())
  })

  it('shows error alert when CSV export fails', async () => {
    listAuditLogsMock.mockResolvedValueOnce(fakeLogs)
    listAuditLogsMock.mockRejectedValueOnce(new Error('boom'))
    renderPage()
    await waitFor(() => expect(screen.getByText('POST /api/v1/modules')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /export/i }))
    await userEvent.click(screen.getByText('Export as CSV'))
    await waitFor(() => {
      expect(screen.getByText('Failed to export audit logs')).toBeInTheDocument()
    })
  })

  it('filters by resource type via select', async () => {
    listAuditLogsMock.mockResolvedValue(fakeLogs)
    renderPage()
    await waitFor(() => expect(screen.getByText('POST /api/v1/modules')).toBeInTheDocument())
    await userEvent.click(screen.getByLabelText('Resource Type'))
    await userEvent.click(screen.getByRole('option', { name: 'Module' }))
    await waitFor(() => {
      expect(listAuditLogsMock).toHaveBeenCalledWith(
        expect.objectContaining({ resource_type: 'module' }),
      )
    })
  })

  it('displays the legacy terraform_mirror resource type as "Binary Mirror"', async () => {
    listAuditLogsMock.mockResolvedValue({
      logs: [
        {
          id: 'log-bm',
          created_at: '2025-06-03T09:00:00Z',
          action: 'POST /api/v1/admin/terraform-mirrors',
          resource_type: 'terraform_mirror',
          resource_id: 'cfg-1',
          user_email: 'admin@example.com',
          ip_address: '10.0.0.2',
        },
      ],
      pagination: { total: 1, page: 1, per_page: 25 },
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText('POST /api/v1/admin/terraform-mirrors')).toBeInTheDocument(),
    )
    // Raw backend value is surfaced consistently as the friendly label.
    expect(screen.getByText('Binary Mirror')).toBeInTheDocument()
    expect(screen.queryByText('terraform_mirror')).not.toBeInTheDocument()
  })

  it('filters by the Binary Mirror option using the legacy backend value', async () => {
    listAuditLogsMock.mockResolvedValue(fakeLogs)
    renderPage()
    await waitFor(() => expect(screen.getByText('POST /api/v1/modules')).toBeInTheDocument())
    await userEvent.click(screen.getByLabelText('Resource Type'))
    await userEvent.click(screen.getByRole('option', { name: 'Binary Mirror' }))
    await waitFor(() => {
      expect(listAuditLogsMock).toHaveBeenCalledWith(
        expect.objectContaining({ resource_type: 'terraform_mirror' }),
      )
    })
  })

  it('types in Action filter and triggers debounced refetch', async () => {
    listAuditLogsMock.mockResolvedValue(fakeLogs)
    renderPage()
    await waitFor(() => expect(screen.getByText('POST /api/v1/modules')).toBeInTheDocument())
    const actionInput = screen.getByLabelText('Action')
    fireEvent.change(actionInput, { target: { value: 'POST' } })
    // Wait for debounce (400ms)
    await new Promise((r) => setTimeout(r, 500))
    await waitFor(() => {
      expect(listAuditLogsMock).toHaveBeenCalledWith(expect.objectContaining({ action: 'POST' }))
    })
  })

  it('types in User Email filter and triggers debounced refetch', async () => {
    listAuditLogsMock.mockResolvedValue(fakeLogs)
    renderPage()
    await waitFor(() => expect(screen.getByText('POST /api/v1/modules')).toBeInTheDocument())
    const emailInput = screen.getByLabelText('User Email')
    fireEvent.change(emailInput, { target: { value: 'admin@example.com' } })
    await new Promise((r) => setTimeout(r, 500))
    await waitFor(() => {
      expect(listAuditLogsMock).toHaveBeenCalledWith(
        expect.objectContaining({ user_email: 'admin@example.com' }),
      )
    })
  })

  it('clicking Reset clears all filters', async () => {
    listAuditLogsMock.mockResolvedValue(fakeLogs)
    renderPage()
    await waitFor(() => expect(screen.getByText('POST /api/v1/modules')).toBeInTheDocument())
    const actionInput = screen.getByLabelText('Action') as HTMLInputElement
    fireEvent.change(actionInput, { target: { value: 'PATCH' } })
    await userEvent.click(screen.getByRole('button', { name: /^reset$/i }))
    expect(actionInput.value).toBe('')
  })

  it('updates start/end date filters', async () => {
    listAuditLogsMock.mockResolvedValue(fakeLogs)
    renderPage()
    await waitFor(() => expect(screen.getByText('POST /api/v1/modules')).toBeInTheDocument())
    const startDate = screen.getByLabelText(/start date/i)
    fireEvent.change(startDate, { target: { value: '2025-06-01T00:00' } })
    const endDate = screen.getByLabelText(/end date/i)
    fireEvent.change(endDate, { target: { value: '2025-06-30T23:59' } })
    await waitFor(() => {
      expect(listAuditLogsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          start_date: expect.any(String),
          end_date: expect.any(String),
        }),
      )
    })
  })

  it('renders error alert when query fails', async () => {
    listAuditLogsMock.mockRejectedValue(new Error('kaboom'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('kaboom')).toBeInTheDocument()
    })
  })

  it('shows only the generic message when the query fails outside development builds (#618-class)', async () => {
    vi.stubEnv('DEV', false)
    listAuditLogsMock.mockRejectedValue(new Error('relation "audit_logs" does not exist'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Failed to load audit logs')).toBeInTheDocument()
    })
    expect(screen.queryByText('relation "audit_logs" does not exist')).not.toBeInTheDocument()
    vi.unstubAllEnvs()
  })
})

// #797. The organization filter is deliberately a FILTER, not a context:
// unset means "everything this caller may see", which for a platform admin is
// the whole estate. The backend's own comment is the reason — an audit trail
// nobody can review across tenants is not much of an audit trail.
describe('AuditLogPage — organization filter (#797)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.memberships = MEMBERSHIPS
  })

  it('offers the caller\'s memberships plus an explicit "all organizations" option', async () => {
    listAuditLogsMock.mockResolvedValue(fakeLogs)
    renderPage()
    await waitFor(() => expect(screen.getByText('POST /api/v1/modules')).toBeInTheDocument())
    await userEvent.click(screen.getByLabelText('Organization'))
    expect(screen.getByRole('option', { name: 'All Organizations' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'acme' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'beta' })).toBeInTheDocument()
  })

  it('is hidden when the caller belongs to no organization', async () => {
    // Nothing to choose between. Its absence is not a restriction: an unset
    // filter already returns everything the caller may see.
    authState.memberships = []
    listAuditLogsMock.mockResolvedValue(fakeLogs)
    renderPage()
    await waitFor(() => expect(screen.getByText('POST /api/v1/modules')).toBeInTheDocument())
    expect(screen.queryByLabelText('Organization')).not.toBeInTheDocument()
  })

  it('defaults to unset and sends no organization_id', async () => {
    // The load-bearing assertion of #797: a default organization would silently
    // hide the rest of the estate from the person auditing it.
    listAuditLogsMock.mockResolvedValue(fakeLogs)
    renderPage()
    await waitFor(() => expect(listAuditLogsMock).toHaveBeenCalled())
    for (const [params] of listAuditLogsMock.mock.calls) {
      expect(params).not.toHaveProperty('organization_id')
    }
  })

  it('sends organization_id once an organization is chosen', async () => {
    listAuditLogsMock.mockResolvedValue(fakeLogs)
    renderPage()
    await waitFor(() => expect(screen.getByText('POST /api/v1/modules')).toBeInTheDocument())
    await selectOrganization('beta')
    await waitFor(() => {
      expect(listAuditLogsMock).toHaveBeenCalledWith(
        expect.objectContaining({ organization_id: 'org-b' }),
      )
    })
  })

  it('puts the organization in the react-query cache key, not only in the request', async () => {
    // #798: if the key cannot name the organization, switching serves the
    // previous organization's page from cache — instantly, because it is a hit.
    listAuditLogsMock.mockResolvedValue(fakeLogs)
    const { queryClient } = renderPage()
    await waitFor(() => expect(screen.getByText('POST /api/v1/modules')).toBeInTheDocument())
    await selectOrganization('beta')
    await waitFor(() => {
      const keys = queryClient
        .getQueryCache()
        .getAll()
        .map((q) => q.queryKey)
      // The organization is its own trailing key element, so the key varies by
      // organization whether or not it also rode along inside `params`.
      expect(keys.some((k) => k[k.length - 1] === 'org-b')).toBe(true)
    })
  })

  it('clears the organization filter on Reset', async () => {
    listAuditLogsMock.mockResolvedValue(fakeLogs)
    renderPage()
    await waitFor(() => expect(screen.getByText('POST /api/v1/modules')).toBeInTheDocument())
    await selectOrganization('beta')
    await waitFor(() =>
      expect(listAuditLogsMock).toHaveBeenCalledWith(
        expect.objectContaining({ organization_id: 'org-b' }),
      ),
    )
    listAuditLogsMock.mockClear()
    await userEvent.click(screen.getByRole('button', { name: /^reset$/i }))
    await waitFor(() => expect(listAuditLogsMock).toHaveBeenCalled())
    for (const [params] of listAuditLogsMock.mock.calls) {
      expect(params).not.toHaveProperty('organization_id')
    }
  })

  it('reports a 403 as "not a member" rather than a generic load failure', async () => {
    // Distinct and recoverable — the user can pick another organization. The
    // generic message reads like an outage they can do nothing about.
    listAuditLogsMock.mockRejectedValue(forbidden())
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('You are not a member of that organization')).toBeInTheDocument()
    })
    expect(screen.queryByText('Failed to load audit logs')).not.toBeInTheDocument()
  })

  it('reports a 403 from the export as "not a member" too', async () => {
    listAuditLogsMock.mockResolvedValueOnce(fakeLogs)
    listAuditLogsMock.mockRejectedValueOnce(forbidden())
    renderPage()
    await waitFor(() => expect(screen.getByText('POST /api/v1/modules')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /export/i }))
    await userEvent.click(screen.getByText('Export as CSV'))
    await waitFor(() => {
      expect(screen.getByText('You are not a member of that organization')).toBeInTheDocument()
    })
  })
})

// The CSV on this page is compliance evidence. An export that covers a
// different slice of the estate than the table it was taken from is misleading
// evidence, not a cosmetic bug — in either direction.
describe('AuditLogPage — exports describe exactly what the table shows (#797)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.memberships = MEMBERSHIPS
  })

  it.each([
    ['CSV', 'Export as CSV'],
    ['JSON', 'Export as JSON'],
  ])('%s export carries the same filters as the table query', async (_label, menuItem) => {
    listAuditLogsMock.mockResolvedValue(fakeLogs)
    renderPage()
    await waitFor(() => expect(screen.getByText('POST /api/v1/modules')).toBeInTheDocument())

    // Narrow on two independent axes so the comparison cannot pass by both
    // sides happening to be empty.
    await userEvent.click(screen.getByLabelText('Resource Type'))
    await userEvent.click(screen.getByRole('option', { name: 'Module' }))
    await selectOrganization('beta')
    await waitFor(() =>
      expect(listAuditLogsMock).toHaveBeenCalledWith(
        expect.objectContaining({ organization_id: 'org-b', resource_type: 'module' }),
      ),
    )

    const tableCalls = listAuditLogsMock.mock.calls
    const tableParams = tableCalls[tableCalls.length - 1][0] as Record<string, unknown>
    listAuditLogsMock.mockClear()

    await userEvent.click(screen.getByRole('button', { name: /export/i }))
    await userEvent.click(screen.getByText(menuItem))
    await waitFor(() => expect(listAuditLogsMock).toHaveBeenCalled())
    const exportParams = listAuditLogsMock.mock.calls[0][0] as Record<string, unknown>

    // Whole filter set, not just the organization: any divergence at all —
    // a filter the export drops, or one it adds — fails here.
    expect(filtersOf(exportParams)).toEqual(filtersOf(tableParams))
    expect(filtersOf(exportParams)).toEqual({ resource_type: 'module', organization_id: 'org-b' })
    // Pagination is the one deliberate difference: the table shows a page, the
    // export takes the whole filtered set.
    expect(exportParams.per_page).toBe(1000)
  })
})
