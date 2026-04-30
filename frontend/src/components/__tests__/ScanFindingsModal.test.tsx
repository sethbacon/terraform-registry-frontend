import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScanFindingsModal from '../ScanFindingsModal'
import type { ModuleScan } from '../../types'

const baseScan: ModuleScan = {
  id: 'scan-1',
  module_version_id: 'ver-1',
  scanner: 'trivy',
  scanner_version: '0.50.0',
  expected_version: null,
  status: 'findings',
  scanned_at: '2026-04-26T23:51:41Z',
  critical_count: 1,
  high_count: 0,
  medium_count: 1,
  low_count: 0,
  raw_results: {
    Results: [
      {
        Target: 'main.tf',
        Misconfigurations: [
          {
            ID: 'AVD-AWS-0001',
            Title: 'S3 bucket unencrypted',
            Severity: 'CRITICAL',
            Resolution: 'Enable encryption',
            CauseMetadata: { Resource: 'aws_s3_bucket.example' },
          },
          {
            ID: 'AVD-AWS-0002',
            Title: 'Public access',
            Severity: 'MEDIUM',
          },
        ],
      },
    ],
  },
  error_message: null,
  created_at: '2026-04-26T23:51:00Z',
  updated_at: '2026-04-26T23:51:41Z',
}

describe('ScanFindingsModal', () => {
  it('does not render content when closed', () => {
    render(<ScanFindingsModal open={false} onClose={() => { }} scan={baseScan} />)
    expect(screen.queryByText('Scan Findings')).not.toBeInTheDocument()
  })

  it('renders findings table when open', () => {
    render(<ScanFindingsModal open={true} onClose={() => { }} scan={baseScan} />)
    expect(screen.getByText('Scan Findings')).toBeInTheDocument()
    expect(screen.getByText('AVD-AWS-0001')).toBeInTheDocument()
    expect(screen.getByText('S3 bucket unencrypted')).toBeInTheDocument()
    expect(screen.getByText('AVD-AWS-0002')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<ScanFindingsModal open={true} onClose={() => { }} scan={null} loading={true} />)
    expect(screen.getByTestId('findings-loading')).toBeInTheDocument()
  })

  it('shows no data message when scan is null', () => {
    render(<ScanFindingsModal open={true} onClose={() => { }} scan={null} />)
    expect(screen.getByText('No scan data available.')).toBeInTheDocument()
  })

  it('shows module label', () => {
    render(
      <ScanFindingsModal
        open={true}
        onClose={() => { }}
        scan={baseScan}
        moduleLabel="hashicorp/vpc/aws v1.0.0"
      />,
    )
    expect(screen.getByText('hashicorp/vpc/aws v1.0.0')).toBeInTheDocument()
  })

  it('toggles raw JSON section', async () => {
    const user = userEvent.setup()
    render(<ScanFindingsModal open={true} onClose={() => { }} scan={baseScan} />)
    const toggle = screen.getByTestId('findings-raw-toggle')
    expect(toggle).toHaveTextContent('Show raw JSON')
    await user.click(toggle)
    expect(toggle).toHaveTextContent('Hide raw JSON')
  })

  it('renders severity chips in header', () => {
    render(<ScanFindingsModal open={true} onClose={() => { }} scan={baseScan} />)
    expect(screen.getByText('Critical: 1')).toBeInTheDocument()
    expect(screen.getByText('Medium: 1')).toBeInTheDocument()
  })

  it('shows fallback message when findings cannot be parsed', () => {
    const scan = { ...baseScan, raw_results: { unknown_format: true } }
    render(<ScanFindingsModal open={true} onClose={() => { }} scan={scan} />)
    expect(
      screen.getByText('Could not parse individual findings from scanner output.'),
    ).toBeInTheDocument()
  })

  describe('CSV export', () => {
    let mockLink: { href: string; download: string; click: ReturnType<typeof vi.fn> }

    beforeEach(() => {
      mockLink = { href: '', download: '', click: vi.fn() }
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') return mockLink as unknown as HTMLElement
        return document.createElement(tag)
      })
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    })

    it('shows Export CSV button when findings are present', () => {
      render(<ScanFindingsModal open={true} onClose={() => { }} scan={baseScan} />)
      expect(screen.getByTestId('findings-csv-download')).toBeInTheDocument()
    })

    it('does not show Export CSV button when findings cannot be parsed', () => {
      const scan = { ...baseScan, raw_results: { unknown_format: true } }
      render(<ScanFindingsModal open={true} onClose={() => { }} scan={scan} />)
      expect(screen.queryByTestId('findings-csv-download')).not.toBeInTheDocument()
    })

    it('triggers CSV download with correct filename when Export CSV is clicked', async () => {
      const user = userEvent.setup()
      render(
        <ScanFindingsModal
          open={true}
          onClose={() => { }}
          scan={baseScan}
          moduleLabel="hashicorp/vpc/aws v1.0.0"
        />,
      )
      await user.click(screen.getByTestId('findings-csv-download'))
      expect(mockLink.click).toHaveBeenCalledOnce()
      expect(mockLink.download).toMatch(/^scan-findings-hashicorp-vpc-aws-v1-0-0-\d{4}-\d{2}-\d{2}\.csv$/)
      expect(URL.createObjectURL).toHaveBeenCalledOnce()
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
    })

    it('CSV content contains header and finding rows', async () => {
      const user = userEvent.setup()
      let capturedCsv = ''
      vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
        if (blob instanceof Blob) blob.text().then((text) => { capturedCsv = text })
        return 'blob:mock'
      })

      render(<ScanFindingsModal open={true} onClose={() => { }} scan={baseScan} />)
      await user.click(screen.getByTestId('findings-csv-download'))

      // Allow the blob.text() promise to resolve
      await new Promise((r) => setTimeout(r, 0))
      expect(capturedCsv).toContain('Severity,Rule ID,Title,Resource,File,Resolution')
      expect(capturedCsv).toContain('CRITICAL')
      expect(capturedCsv).toContain('AVD-AWS-0001')
      expect(capturedCsv).toContain('S3 bucket unencrypted')
    })
  })
})
