import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ---- Mocks ----

const listAuditLogsMock = vi.fn()
vi.mock('../../../services/api', () => ({
  default: {
    listAuditLogs: (...args: unknown[]) => listAuditLogsMock(...args),
    exportAuditLogsCSV: vi.fn(),
    exportAuditLogsJSON: vi.fn(),
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
      expect(
        screen.getByText('No audit entries match the current filters'),
      ).toBeInTheDocument()
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
})
