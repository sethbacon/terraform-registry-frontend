import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCtx = {
  setupStatus: null as { pending_feature_setup?: boolean } | null,
  scanningForm: { enabled: false, tool: 'trivy', binary_path: '', severity_threshold: '' },
  setScanningForm: vi.fn(),
  scanningTesting: false,
  scanningTestResult: null as { success: boolean; message: string; version?: string } | null,
  setScanningTestResult: vi.fn(),
  scanningSaving: false,
  scanningSaved: false,
  setScanningSaved: vi.fn(),
  testScanning: vi.fn(),
  saveScanning: vi.fn(),
  goToStep: vi.fn(),
}

vi.mock('../../../../contexts/SetupWizardContext', () => ({
  useSetupWizard: () => mockCtx,
}))

import ScanningStep from '../ScanningStep'

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(mockCtx, {
    setupStatus: null,
    scanningForm: { enabled: false, tool: 'trivy', binary_path: '', severity_threshold: '' },
    scanningTesting: false,
    scanningTestResult: null,
    scanningSaving: false,
    scanningSaved: false,
  })
})

describe('ScanningStep', () => {
  it('renders heading and toggle', () => {
    render(<ScanningStep />)
    expect(screen.getByText('Security Scanning')).toBeInTheDocument()
    expect(screen.getByLabelText('Enable security scanning')).toBeInTheDocument()
  })

  it('shows Skip button when scanning is disabled', () => {
    render(<ScanningStep />)
    expect(screen.getByRole('button', { name: /Skip/i })).toBeInTheDocument()
  })

  it('hides scanning fields when disabled', () => {
    render(<ScanningStep />)
    // Collapse renders children but hidden — check visibility instead
    expect(screen.queryByRole('button', { name: /Test Configuration/i })).not.toBeInTheDocument()
  })

  it('shows scanning fields when enabled', () => {
    mockCtx.scanningForm = { enabled: true, tool: 'trivy', binary_path: '', severity_threshold: '' }
    render(<ScanningStep />)
    expect(screen.getByLabelText('Binary Path')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Test Configuration/i })).toBeInTheDocument()
  })

  it('hides Skip button when enabled', () => {
    mockCtx.scanningForm = { enabled: true, tool: 'trivy', binary_path: '', severity_threshold: '' }
    render(<ScanningStep />)
    expect(screen.queryByRole('button', { name: /Skip/i })).not.toBeInTheDocument()
  })

  it('calls testScanning on Test button click', async () => {
    mockCtx.scanningForm = { enabled: true, tool: 'trivy', binary_path: '', severity_threshold: '' }
    render(<ScanningStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Test Configuration/i }))
    expect(mockCtx.testScanning).toHaveBeenCalledOnce()
  })

  it('disables Save button when test has not succeeded', () => {
    mockCtx.scanningForm = { enabled: true, tool: 'trivy', binary_path: '', severity_threshold: '' }
    render(<ScanningStep />)
    expect(screen.getByRole('button', { name: /Save Scanning/i })).toBeDisabled()
  })

  it('enables Save button after successful test', () => {
    mockCtx.scanningForm = { enabled: true, tool: 'trivy', binary_path: '', severity_threshold: '' }
    mockCtx.scanningTestResult = { success: true, message: 'Trivy found', version: '0.50.0' }
    render(<ScanningStep />)
    expect(screen.getByRole('button', { name: /Save Scanning/i })).toBeEnabled()
  })

  it('shows test result alert on success', () => {
    mockCtx.scanningForm = { enabled: true, tool: 'trivy', binary_path: '', severity_threshold: '' }
    mockCtx.scanningTestResult = { success: true, message: 'Trivy found', version: '0.50.0' }
    render(<ScanningStep />)
    expect(screen.getByText(/Trivy found/)).toBeInTheDocument()
    expect(screen.getByText(/0\.50\.0/)).toBeInTheDocument()
  })

  it('shows test result alert on error', () => {
    mockCtx.scanningForm = { enabled: true, tool: 'trivy', binary_path: '', severity_threshold: '' }
    mockCtx.scanningTestResult = { success: false, message: 'Trivy not found' }
    render(<ScanningStep />)
    expect(screen.getByText(/Trivy not found/)).toBeInTheDocument()
  })

  it('shows Next button when saved and enabled', () => {
    mockCtx.scanningForm = { enabled: true, tool: 'trivy', binary_path: '', severity_threshold: '' }
    mockCtx.scanningSaved = true
    render(<ScanningStep />)
    expect(screen.getByRole('button', { name: /Next: Configure Admin/i })).toBeInTheDocument()
  })

  it('navigates back on Back click', async () => {
    render(<ScanningStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Back/i }))
    expect(mockCtx.goToStep).toHaveBeenCalledWith(2)
  })

  it('skips and goes to step 4 on Skip click', async () => {
    render(<ScanningStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Skip/i }))
    expect(mockCtx.setScanningSaved).toHaveBeenCalledWith(true)
    expect(mockCtx.goToStep).toHaveBeenCalledWith(4)
  })

  it('toggles enabled and resets test result', async () => {
    render(<ScanningStep />)
    await userEvent.setup().click(screen.getByLabelText('Enable security scanning'))
    expect(mockCtx.setScanningForm).toHaveBeenCalled()
    expect(mockCtx.setScanningTestResult).toHaveBeenCalledWith(null)
    expect(mockCtx.setScanningSaved).toHaveBeenCalledWith(false)
  })

  it('disables Test button when scanningTesting', () => {
    mockCtx.scanningForm = { enabled: true, tool: 'trivy', binary_path: '', severity_threshold: '' }
    mockCtx.scanningTesting = true
    render(<ScanningStep />)
    expect(screen.getByRole('button', { name: /Test Configuration/i })).toBeDisabled()
  })

  it('disables Save button when scanningSaving', () => {
    mockCtx.scanningForm = { enabled: true, tool: 'trivy', binary_path: '', severity_threshold: '' }
    mockCtx.scanningSaving = true
    render(<ScanningStep />)
    expect(screen.getByRole('button', { name: /Save Scanning/i })).toBeDisabled()
  })
})

describe('ScanningStep — pending feature setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(mockCtx, {
      setupStatus: { pending_feature_setup: true },
      scanningForm: { enabled: false, tool: 'trivy', binary_path: '', severity_threshold: '' },
      scanningTesting: false,
      scanningTestResult: null,
      scanningSaving: false,
      scanningSaved: false,
    })
  })

  it('navigates back to step 0 in pending mode', async () => {
    render(<ScanningStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Back/i }))
    expect(mockCtx.goToStep).toHaveBeenCalledWith(0)
  })

  it('skips to step 5 in pending mode', async () => {
    render(<ScanningStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Skip/i }))
    expect(mockCtx.goToStep).toHaveBeenCalledWith(5)
  })

  it('shows "Next: Review & Complete" label in pending mode', () => {
    mockCtx.scanningForm = { enabled: true, tool: 'trivy', binary_path: '', severity_threshold: '' }
    mockCtx.scanningSaved = true
    render(<ScanningStep />)
    expect(screen.getByRole('button', { name: /Next: Review & Complete/i })).toBeInTheDocument()
  })
})
