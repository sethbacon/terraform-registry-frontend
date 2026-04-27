import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import type { ModuleVersion, ModuleScan } from '../../types'
import SecurityScanPanel from '../SecurityScanPanel'

const fakeVersion: ModuleVersion = {
  id: 'v1',
  module_id: 'm1',
  version: '1.0.0',
  download_count: 0,
}

const baseScan: ModuleScan = {
  id: 's1',
  module_version_id: 'v1',
  scanner: 'trivy',
  scanner_version: '0.50.0',
  expected_version: null,
  status: 'clean',
  scanned_at: '2025-01-01T00:00:00Z',
  critical_count: 0,
  high_count: 0,
  medium_count: 0,
  low_count: 0,
  raw_results: null,
  error_message: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

describe('SecurityScanPanel', () => {
  it('renders nothing when canManage is false', () => {
    const { container } = render(
      <SecurityScanPanel
        canManage={false}
        selectedVersion={fakeVersion}
        moduleScan={null}
        scanLoading={false}
        scanNotFound={false}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when selectedVersion is null', () => {
    const { container } = render(
      <SecurityScanPanel
        canManage={true}
        selectedVersion={null}
        moduleScan={null}
        scanLoading={false}
        scanNotFound={false}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('shows loading spinner when scanLoading', () => {
    render(
      <SecurityScanPanel
        canManage={true}
        selectedVersion={fakeVersion}
        moduleScan={null}
        scanLoading={true}
        scanNotFound={false}
      />,
    )
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows "No scan available" when scanNotFound', () => {
    render(
      <SecurityScanPanel
        canManage={true}
        selectedVersion={fakeVersion}
        moduleScan={null}
        scanLoading={false}
        scanNotFound={true}
      />,
    )
    expect(screen.getByText(/no scan available/i)).toBeInTheDocument()
  })

  it('shows clean status chip when scan is clean', () => {
    render(
      <SecurityScanPanel
        canManage={true}
        selectedVersion={fakeVersion}
        moduleScan={{ ...baseScan, status: 'clean' }}
        scanLoading={false}
        scanNotFound={false}
      />,
    )
    expect(screen.getByText(/clean/i)).toBeInTheDocument()
  })

  it('shows severity counts when scan has findings', () => {
    render(
      <SecurityScanPanel
        canManage={true}
        selectedVersion={fakeVersion}
        moduleScan={{
          ...baseScan,
          status: 'findings',
          critical_count: 1,
          high_count: 2,
          medium_count: 3,
          low_count: 4,
        }}
        scanLoading={false}
        scanNotFound={false}
      />,
    )
    expect(screen.getByText(/findings/i)).toBeInTheDocument()
  })

  it('shows error chip when scan has error status', () => {
    render(
      <SecurityScanPanel
        canManage={true}
        selectedVersion={fakeVersion}
        moduleScan={{ ...baseScan, status: 'error', error_message: 'Scanner timed out' }}
        scanLoading={false}
        scanNotFound={false}
      />,
    )
    expect(screen.getByText('error')).toBeInTheDocument()
  })

  it('shows Re-scan button when onRescan is provided and scan is not in progress', () => {
    const onRescan = vi.fn()
    render(
      <SecurityScanPanel
        canManage={true}
        selectedVersion={fakeVersion}
        moduleScan={{ ...baseScan, status: 'clean' }}
        scanLoading={false}
        scanNotFound={false}
        onRescan={onRescan}
        rescanPending={false}
      />,
    )
    expect(screen.getByTestId('rescan-button')).toBeInTheDocument()
  })

  it('calls onRescan when Re-scan button is clicked', async () => {
    const onRescan = vi.fn()
    render(
      <SecurityScanPanel
        canManage={true}
        selectedVersion={fakeVersion}
        moduleScan={{ ...baseScan, status: 'clean' }}
        scanLoading={false}
        scanNotFound={false}
        onRescan={onRescan}
        rescanPending={false}
      />,
    )
    await userEvent.click(screen.getByTestId('rescan-button'))
    expect(onRescan).toHaveBeenCalledOnce()
  })

  it('hides Re-scan button while scan is in progress', () => {
    render(
      <SecurityScanPanel
        canManage={true}
        selectedVersion={fakeVersion}
        moduleScan={{ ...baseScan, status: 'scanning' }}
        scanLoading={false}
        scanNotFound={false}
        onRescan={vi.fn()}
        rescanPending={false}
      />,
    )
    expect(screen.queryByTestId('rescan-button')).not.toBeInTheDocument()
  })

  it('hides Re-scan button while rescanPending is true', () => {
    render(
      <SecurityScanPanel
        canManage={true}
        selectedVersion={fakeVersion}
        moduleScan={{ ...baseScan, status: 'clean' }}
        scanLoading={false}
        scanNotFound={false}
        onRescan={vi.fn()}
        rescanPending={true}
      />,
    )
    expect(screen.queryByTestId('rescan-button')).not.toBeInTheDocument()
  })

  // Diagnostics — added in #199
  describe('scanner output diagnostics', () => {
    it('does not show the toggle when no execution_log or raw_results are present', () => {
      render(
        <SecurityScanPanel
          canManage={true}
          selectedVersion={fakeVersion}
          moduleScan={{ ...baseScan, status: 'clean' }}
          scanLoading={false}
          scanNotFound={false}
        />,
      )
      expect(screen.queryByTestId('scan-diagnostics-toggle')).not.toBeInTheDocument()
    })

    it('shows the toggle and reveals scanner output on click when execution_log is present', async () => {
      const user = userEvent.setup()
      render(
        <SecurityScanPanel
          canManage={true}
          selectedVersion={fakeVersion}
          moduleScan={{
            ...baseScan,
            status: 'error',
            error_message: 'exit 1',
            execution_log: 'fatal: cannot read tfconfig',
          }}
          scanLoading={false}
          scanNotFound={false}
        />,
      )

      // Error alert is always shown immediately for an error status
      expect(screen.getByTestId('scan-error-alert')).toBeInTheDocument()

      // Diagnostics start collapsed
      expect(screen.queryByText('fatal: cannot read tfconfig')).not.toBeInTheDocument()

      // Expand
      await user.click(screen.getByTestId('scan-diagnostics-toggle'))
      expect(screen.getByTestId('scan-diagnostics-log')).toBeInTheDocument()
      expect(screen.getByText('fatal: cannot read tfconfig')).toBeInTheDocument()
    })

    it('reveals raw scanner JSON when raw_results has content', async () => {
      const user = userEvent.setup()
      render(
        <SecurityScanPanel
          canManage={true}
          selectedVersion={fakeVersion}
          moduleScan={{
            ...baseScan,
            status: 'findings',
            raw_results: { Results: [{ id: 'CVE-2026-0001' }] },
          }}
          scanLoading={false}
          scanNotFound={false}
        />,
      )
      await user.click(screen.getByTestId('scan-diagnostics-toggle'))
      expect(screen.getByText(/CVE-2026-0001/)).toBeInTheDocument()
    })
  })
})
