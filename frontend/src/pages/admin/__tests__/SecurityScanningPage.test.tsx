import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  // Scanner Health + diagnostics — added in #199
  describe('scanner health and diagnostics', () => {
    const failedScan = {
      id: 's-err',
      namespace: 'acme',
      module_name: 'vpc',
      system: 'aws',
      module_version: '2.0.0',
      scanner: 'trivy',
      status: 'error',
      critical_count: 0,
      high_count: 0,
      medium_count: 0,
      low_count: 0,
      scanned_at: new Date(Date.now() - 5 * 60_000).toISOString(),
      created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
      error_message: 'scanner exited 1',
      execution_log: 'panic: runtime error: invalid memory address',
    }

    it('renders Scanner Health card when scans are present', async () => {
      getScanningConfigMock.mockResolvedValue(fakeConfig)
      getScanningStatsMock.mockResolvedValue(fakeStats)
      renderPage()
      await waitFor(() => {
        expect(screen.getByTestId('scanner-health')).toBeInTheDocument()
      })
      expect(screen.getByText('Scanner Health')).toBeInTheDocument()
      expect(screen.getByText('Last successful scan')).toBeInTheDocument()
    })

    it('hides Scanner Health card when there are no scans', async () => {
      getScanningConfigMock.mockResolvedValue(fakeConfig)
      getScanningStatsMock.mockResolvedValue({ ...fakeStats, recent_scans: [] })
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('No scans recorded yet.')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('scanner-health')).not.toBeInTheDocument()
    })

    it('reports a non-zero error rate when window contains errors', async () => {
      getScanningConfigMock.mockResolvedValue(fakeConfig)
      getScanningStatsMock.mockResolvedValue({
        ...fakeStats,
        recent_scans: [failedScan, fakeStats.recent_scans[0]],
      })
      renderPage()
      const health = await screen.findByTestId('scanner-health')
      // 1 error out of 2 terminal scans = 50%
      expect(within(health).getByText('50%')).toBeInTheDocument()
    })

    it('does not render an expand toggle for scans with no diagnostics', async () => {
      getScanningConfigMock.mockResolvedValue(fakeConfig)
      getScanningStatsMock.mockResolvedValue(fakeStats)
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('hashicorp/consul/aws')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('scan-row-toggle-s-1')).not.toBeInTheDocument()
    })

    it('expands a failed scan row to show execution_log on toggle click', async () => {
      const user = userEvent.setup()
      getScanningConfigMock.mockResolvedValue(fakeConfig)
      getScanningStatsMock.mockResolvedValue({
        ...fakeStats,
        recent_scans: [failedScan],
      })
      renderPage()

      const toggle = await screen.findByTestId('scan-row-toggle-s-err')

      // Collapsed initially
      expect(screen.queryByText(/panic: runtime error/)).not.toBeInTheDocument()

      await user.click(toggle)
      expect(await screen.findByText(/panic: runtime error/)).toBeInTheDocument()
      expect(screen.getByText('scanner exited 1')).toBeInTheDocument()
    })
  })
})
