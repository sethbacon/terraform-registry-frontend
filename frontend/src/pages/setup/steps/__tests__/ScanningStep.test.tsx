import { render, screen, fireEvent, within } from '@testing-library/react'
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
  scanningInstalling: false,
  scanningInstallResult: null as {
    success: boolean
    tool: string
    version: string
    binary_path: string
    sha256: string
    source_url: string
    error?: string
  } | null,
  installScanner: vi.fn(),
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
    scanningInstalling: false,
    scanningInstallResult: null,
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
    mockCtx.scanningForm = {
      enabled: true,
      tool: 'trivy',
      binary_path: '',
      severity_threshold: '',
    }
    render(<ScanningStep />)
    expect(screen.getByLabelText('Binary Path')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Test Configuration/i })).toBeInTheDocument()
  })

  it('hides Skip button when enabled', () => {
    mockCtx.scanningForm = {
      enabled: true,
      tool: 'trivy',
      binary_path: '',
      severity_threshold: '',
    }
    render(<ScanningStep />)
    expect(screen.queryByRole('button', { name: /Skip/i })).not.toBeInTheDocument()
  })

  it('calls testScanning on Test button click', async () => {
    mockCtx.scanningForm = {
      enabled: true,
      tool: 'trivy',
      binary_path: '',
      severity_threshold: '',
    }
    render(<ScanningStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Test Configuration/i }))
    expect(mockCtx.testScanning).toHaveBeenCalledOnce()
  })

  it('disables Save button when test has not succeeded', () => {
    mockCtx.scanningForm = {
      enabled: true,
      tool: 'trivy',
      binary_path: '',
      severity_threshold: '',
    }
    render(<ScanningStep />)
    expect(screen.getByRole('button', { name: /Save Scanning/i })).toBeDisabled()
  })

  it('enables Save button after successful test', () => {
    mockCtx.scanningForm = {
      enabled: true,
      tool: 'trivy',
      binary_path: '',
      severity_threshold: '',
    }
    mockCtx.scanningTestResult = {
      success: true,
      message: 'Trivy found',
      version: '0.50.0',
    }
    render(<ScanningStep />)
    expect(screen.getByRole('button', { name: /Save Scanning/i })).toBeEnabled()
  })

  it('shows test result alert on success', () => {
    mockCtx.scanningForm = {
      enabled: true,
      tool: 'trivy',
      binary_path: '',
      severity_threshold: '',
    }
    mockCtx.scanningTestResult = {
      success: true,
      message: 'Trivy found',
      version: '0.50.0',
    }
    render(<ScanningStep />)
    expect(screen.getByText(/Trivy found/)).toBeInTheDocument()
    expect(screen.getByText(/0\.50\.0/)).toBeInTheDocument()
  })

  it('shows test result alert on error', () => {
    mockCtx.scanningForm = {
      enabled: true,
      tool: 'trivy',
      binary_path: '',
      severity_threshold: '',
    }
    mockCtx.scanningTestResult = { success: false, message: 'Trivy not found' }
    render(<ScanningStep />)
    expect(screen.getByText(/Trivy not found/)).toBeInTheDocument()
  })

  it('shows Next button when saved and enabled', () => {
    mockCtx.scanningForm = {
      enabled: true,
      tool: 'trivy',
      binary_path: '',
      severity_threshold: '',
    }
    mockCtx.scanningSaved = true
    render(<ScanningStep />)
    expect(screen.getByRole('button', { name: /Next: Branding/i })).toBeInTheDocument()
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
    mockCtx.scanningForm = {
      enabled: true,
      tool: 'trivy',
      binary_path: '',
      severity_threshold: '',
    }
    mockCtx.scanningTesting = true
    render(<ScanningStep />)
    expect(screen.getByRole('button', { name: /Test Configuration/i })).toBeDisabled()
  })

  it('disables Save button when scanningSaving', () => {
    mockCtx.scanningForm = {
      enabled: true,
      tool: 'trivy',
      binary_path: '',
      severity_threshold: '',
    }
    mockCtx.scanningSaving = true
    render(<ScanningStep />)
    expect(screen.getByRole('button', { name: /Save Scanning/i })).toBeDisabled()
  })

  it('calls setScanningForm when binary path changes', async () => {
    mockCtx.scanningForm = {
      enabled: true,
      tool: 'trivy',
      binary_path: '',
      severity_threshold: '',
    }
    render(<ScanningStep />)
    const input = screen.getByLabelText('Binary Path')
    await userEvent.setup().type(input, '/usr/bin/trivy')
    expect(mockCtx.setScanningForm).toHaveBeenCalled()
  })

  it('calls setScanningForm when severity threshold changes', async () => {
    mockCtx.scanningForm = {
      enabled: true,
      tool: 'trivy',
      binary_path: '',
      severity_threshold: '',
    }
    render(<ScanningStep />)
    const input = screen.getByLabelText(/Severity Threshold/i)
    await userEvent.setup().type(input, 'HIGH')
    expect(mockCtx.setScanningForm).toHaveBeenCalled()
  })

  it('calls setScanningForm when scanning tool is changed', async () => {
    mockCtx.scanningForm = {
      enabled: true,
      tool: 'trivy',
      binary_path: '',
      severity_threshold: '',
    }
    render(<ScanningStep />)
    // Open the MUI Select dropdown and pick a different tool
    // MUI Select requires mouseDown on the element with role=combobox to open
    const trigger = screen.getByRole('combobox')
    fireEvent.mouseDown(trigger)
    const listbox = within(screen.getByRole('listbox'))
    fireEvent.click(listbox.getByText('Checkov'))
    expect(mockCtx.setScanningForm).toHaveBeenCalled()
    expect(mockCtx.setScanningTestResult).toHaveBeenCalledWith(null)
    expect(mockCtx.setScanningSaved).toHaveBeenCalledWith(false)
  })
})

describe('ScanningStep — auto-install', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(mockCtx, {
      setupStatus: null,
      scanningForm: {
        enabled: true,
        tool: 'trivy',
        binary_path: '',
        severity_threshold: '',
      },
      scanningTesting: false,
      scanningTestResult: null,
      scanningSaving: false,
      scanningSaved: false,
      scanningInstalling: false,
      scanningInstallResult: null,
    })
  })

  it('shows auto-install panel for installable tools', () => {
    render(<ScanningStep />)
    expect(screen.getByText('Auto-Install')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Install trivy/i })).toBeInTheDocument()
  })

  it('hides auto-install panel for snyk', () => {
    mockCtx.scanningForm = {
      enabled: true,
      tool: 'snyk',
      binary_path: '',
      severity_threshold: '',
    }
    render(<ScanningStep />)
    expect(screen.queryByText('Auto-Install')).not.toBeInTheDocument()
  })

  it('hides auto-install panel for custom', () => {
    mockCtx.scanningForm = {
      enabled: true,
      tool: 'custom',
      binary_path: '',
      severity_threshold: '',
    }
    render(<ScanningStep />)
    expect(screen.queryByText('Auto-Install')).not.toBeInTheDocument()
  })

  it('calls installScanner on Install button click', async () => {
    render(<ScanningStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Install trivy/i }))
    expect(mockCtx.installScanner).toHaveBeenCalledWith(undefined)
  })

  it('disables Install button when scanningInstalling', () => {
    mockCtx.scanningInstalling = true
    render(<ScanningStep />)
    expect(screen.getByRole('button', { name: /Installing/i })).toBeDisabled()
  })

  it('shows success alert after install', () => {
    mockCtx.scanningInstallResult = {
      success: true,
      tool: 'trivy',
      version: '0.58.0',
      binary_path: '/app/scanners/trivy',
      sha256: 'abc123def456789012345678',
      source_url: 'https://github.com/aquasecurity/trivy/releases',
    }
    render(<ScanningStep />)
    expect(screen.getByText(/trivy 0\.58\.0/)).toBeInTheDocument()
    expect(screen.getByText(/\/app\/scanners\/trivy/)).toBeInTheDocument()
  })

  it('shows error alert after failed install', () => {
    mockCtx.scanningInstallResult = {
      success: false,
      tool: 'trivy',
      version: '',
      binary_path: '',
      sha256: '',
      source_url: '',
      error: 'no matching asset for this OS/arch',
    }
    render(<ScanningStep />)
    expect(screen.getByText(/no matching asset/)).toBeInTheDocument()
  })

  it('shows auto-install panel for checkov', () => {
    mockCtx.scanningForm = {
      enabled: true,
      tool: 'checkov',
      binary_path: '',
      severity_threshold: '',
    }
    render(<ScanningStep />)
    expect(screen.getByRole('button', { name: /Install checkov/i })).toBeInTheDocument()
  })

  it('shows auto-install panel for terrascan', () => {
    mockCtx.scanningForm = {
      enabled: true,
      tool: 'terrascan',
      binary_path: '',
      severity_threshold: '',
    }
    render(<ScanningStep />)
    expect(screen.getByRole('button', { name: /Install terrascan/i })).toBeInTheDocument()
  })
})

describe('ScanningStep — pending feature setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(mockCtx, {
      setupStatus: { pending_feature_setup: true },
      scanningForm: {
        enabled: false,
        tool: 'trivy',
        binary_path: '',
        severity_threshold: '',
      },
      scanningTesting: false,
      scanningTestResult: null,
      scanningSaving: false,
      scanningSaved: false,
      scanningInstalling: false,
      scanningInstallResult: null,
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
    expect(mockCtx.goToStep).toHaveBeenCalledWith(6)
  })

  it('shows "Next: Review & Complete" label in pending mode', () => {
    mockCtx.scanningForm = {
      enabled: true,
      tool: 'trivy',
      binary_path: '',
      severity_threshold: '',
    }
    mockCtx.scanningSaved = true
    render(<ScanningStep />)
    expect(screen.getByRole('button', { name: /Next: Review & Complete/i })).toBeInTheDocument()
  })
})
