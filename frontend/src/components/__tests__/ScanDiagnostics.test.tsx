import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ScanDiagnostics from '../ScanDiagnostics'

describe('ScanDiagnostics', () => {
  it('renders nothing when all fields are empty', () => {
    const { container } = render(
      <ScanDiagnostics errorMessage={null} executionLog={null} rawResults={null} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when rawResults is an empty object', () => {
    const { container } = render(<ScanDiagnostics rawResults={{}} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the error message section when provided', () => {
    render(<ScanDiagnostics errorMessage="exec format error" />)
    expect(screen.getByTestId('scan-diagnostics-error')).toBeInTheDocument()
    expect(screen.getByText('exec format error')).toBeInTheDocument()
  })

  it('renders the scanner output section when execution_log is provided', () => {
    render(<ScanDiagnostics executionLog="line 1\nline 2" />)
    expect(screen.getByTestId('scan-diagnostics-log')).toBeInTheDocument()
    expect(screen.getByText(/line 1/)).toBeInTheDocument()
  })

  it('renders raw scanner JSON when rawResults has keys', () => {
    render(<ScanDiagnostics rawResults={{ vulns: 3 }} />)
    expect(screen.getByTestId('scan-diagnostics-raw')).toBeInTheDocument()
    expect(screen.getByText(/"vulns": 3/)).toBeInTheDocument()
  })

  it('renders all three sections together', () => {
    render(
      <ScanDiagnostics
        errorMessage="boom"
        executionLog="stderr output"
        rawResults={{ a: 1 }}
      />,
    )
    expect(screen.getByTestId('scan-diagnostics-error')).toBeInTheDocument()
    expect(screen.getByTestId('scan-diagnostics-log')).toBeInTheDocument()
    expect(screen.getByTestId('scan-diagnostics-raw')).toBeInTheDocument()
  })
})
