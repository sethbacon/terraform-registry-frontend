import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import SecurityScanPanel from '../SecurityScanPanel'

describe('SecurityScanPanel', () => {
  it('renders nothing when canManage is false', () => {
    const { container } = render(
      <SecurityScanPanel
        canManage={false}
        selectedVersion="1.0.0"
        moduleScan={null}
        scanLoading={false}
        scanNotFound={false}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when selectedVersion is empty', () => {
    const { container } = render(
      <SecurityScanPanel
        canManage={true}
        selectedVersion=""
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
        selectedVersion="1.0.0"
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
        selectedVersion="1.0.0"
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
        selectedVersion="1.0.0"
        moduleScan={{
          status: 'clean',
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        }}
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
        selectedVersion="1.0.0"
        moduleScan={{
          status: 'findings',
          critical: 1,
          high: 2,
          medium: 3,
          low: 4,
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
        selectedVersion="1.0.0"
        moduleScan={{
          status: 'error',
          message: 'Scanner timed out',
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        }}
        scanLoading={false}
        scanNotFound={false}
      />,
    )
    expect(screen.getByText('error')).toBeInTheDocument()
  })
})
