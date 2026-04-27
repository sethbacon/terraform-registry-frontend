import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

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

import AuditLogPage from '../../admin/AuditLogPage'

// ---- Helpers ----

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
}

function renderPage() {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <AuditLogPage />
    </QueryClientProvider>,
  )
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
  })

  it('shows loading spinner while fetching', () => {
    listAuditLogsMock.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders heading "Audit Logs"', () => {
    listAuditLogsMock.mockReturnValue(new Promise(() => {}))
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
    listAuditLogsMock.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByLabelText('Resource Type')).toBeInTheDocument()
    expect(screen.getByLabelText('Action')).toBeInTheDocument()
    expect(screen.getByText('Reset')).toBeInTheDocument()
  })

  it('shows Export button', () => {
    listAuditLogsMock.mockReturnValue(new Promise(() => {}))
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
})
