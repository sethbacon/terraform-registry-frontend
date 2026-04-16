import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock api
const getScanningConfigMock = vi.fn()
const getScanningStatsMock = vi.fn()
vi.mock('../../../services/api', () => ({
  default: {
    getScanningConfig: (...args: unknown[]) => getScanningConfigMock(...args),
    getScanningStats: (...args: unknown[]) => getScanningStatsMock(...args),
  },
}))

import SecurityScanningPage from '../../admin/SecurityScanningPage'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
}

function renderPage() {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <SecurityScanningPage />
    </QueryClientProvider>,
  )
}

const fakeConfig = {
  enabled: true,
  tool: 'trivy',
  expected_version: '0.50.0',
  severity_threshold: 'HIGH',
  timeout: '5m',
  worker_count: 2,
  scan_interval_mins: 60,
}

const fakeStats = {
  total: 25,
  pending: 2,
  clean: 18,
  findings: 3,
  error: 2,
  recent_scans: [
    {
      id: 's-1',
      namespace: 'hashicorp',
      module_name: 'consul',
      system: 'aws',
      module_version: '1.0.0',
      scanner: 'trivy',
      status: 'clean',
      critical_count: 0,
      high_count: 0,
      medium_count: 1,
      low_count: 3,
      scanned_at: new Date().toISOString(),
    },
  ],
}

describe('SecurityScanningPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner initially', () => {
    getScanningConfigMock.mockReturnValue(new Promise(() => {}))
    getScanningStatsMock.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders page heading', () => {
    getScanningConfigMock.mockReturnValue(new Promise(() => {}))
    getScanningStatsMock.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Security Scanning')).toBeInTheDocument()
  })

  it('renders configuration section after load', async () => {
    getScanningConfigMock.mockResolvedValue(fakeConfig)
    getScanningStatsMock.mockResolvedValue(fakeStats)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Configuration')).toBeInTheDocument()
    })
    expect(screen.getByText('Enabled')).toBeInTheDocument()
    // 'trivy' appears in both config and recent scans table
    expect(screen.getAllByText('trivy').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('0.50.0')).toBeInTheDocument()
    expect(screen.getByText('HIGH')).toBeInTheDocument()
  })

  it('renders summary stats', async () => {
    getScanningConfigMock.mockResolvedValue(fakeConfig)
    getScanningStatsMock.mockResolvedValue(fakeStats)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Total Scans')).toBeInTheDocument()
    })
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
  })

  it('renders recent scans table', async () => {
    getScanningConfigMock.mockResolvedValue(fakeConfig)
    getScanningStatsMock.mockResolvedValue(fakeStats)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Recent Scans')).toBeInTheDocument()
    })
    expect(screen.getByText('hashicorp/consul/aws')).toBeInTheDocument()
    expect(screen.getByText('1.0.0')).toBeInTheDocument()
  })

  it('shows error when API fails', async () => {
    getScanningConfigMock.mockRejectedValue(new Error('fail'))
    getScanningStatsMock.mockRejectedValue(new Error('fail'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Failed to load scanning data.')).toBeInTheDocument()
    })
  })

  it('shows no scans message when empty', async () => {
    getScanningConfigMock.mockResolvedValue(fakeConfig)
    getScanningStatsMock.mockResolvedValue({ ...fakeStats, recent_scans: [] })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('No scans recorded yet.')).toBeInTheDocument()
    })
  })
})
