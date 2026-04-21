import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

// ---- Mocks ----

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const getSetupStatusMock = vi.fn()
const validateSetupTokenMock = vi.fn()
const saveOIDCConfigMock = vi.fn()
const saveSetupStorageConfigMock = vi.fn()
const testScanningConfigMock = vi.fn()
const saveScanningConfigMock = vi.fn()

vi.mock('../../services/api', () => ({
  default: {
    getSetupStatus: (...args: unknown[]) => getSetupStatusMock(...args),
    validateSetupToken: (...args: unknown[]) => validateSetupTokenMock(...args),
    testOIDCConfig: vi.fn(),
    saveOIDCConfig: (...args: unknown[]) => saveOIDCConfigMock(...args),
    testLDAPConfig: vi.fn(),
    saveLDAPConfig: vi.fn(),
    testSetupStorageConfig: vi.fn(),
    saveSetupStorageConfig: (...args: unknown[]) => saveSetupStorageConfigMock(...args),
    testScanningConfig: (...args: unknown[]) => testScanningConfigMock(...args),
    saveScanningConfig: (...args: unknown[]) => saveScanningConfigMock(...args),
    configureAdmin: vi.fn(),
    completeSetup: vi.fn(),
  },
}))

// Must import AFTER mocks are declared
import SetupWizardPage from '../SetupWizardPage'

// ---- Helpers ----

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/setup']}>
      <SetupWizardPage />
    </MemoryRouter>
  )
}

/**
 * Advance the wizard to the given step index.
 * 0 = Authenticate, 1 = OIDC, 2 = Storage, 3 = Scanning, 4 = Admin, 5 = Complete
 */
async function advanceToStep(stepIndex: number) {
  const user = userEvent.setup()

  // Step 0 -> 1: validate token
  if (stepIndex >= 1) {
    validateSetupTokenMock.mockResolvedValue({ valid: true })
    const tokenInput = screen.getByLabelText('Setup Token')
    await user.type(tokenInput, 'tfr_setup_test123')
    await user.click(screen.getByRole('button', { name: 'Verify Token' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Identity Provider' })).toBeInTheDocument()
    })
  }

  // Step 1 -> 2: save OIDC then click Next
  if (stepIndex >= 2) {
    saveOIDCConfigMock.mockResolvedValue({ id: 'oidc-1' })
    const issuerInput = screen.getByPlaceholderText('https://accounts.google.com')
    await user.type(issuerInput, 'https://issuer.example.com')
    const clientIdInput = screen.getByRole('textbox', { name: /Client ID/i })
    await user.type(clientIdInput, 'test-client-id')
    const clientSecretInput = screen.getByLabelText(/Client Secret/i)
    await user.type(clientSecretInput, 'test-secret')
    await user.click(screen.getByRole('button', { name: /Save OIDC Configuration/i }))
    await waitFor(() => {
      expect(screen.getByText(/Next: Configure Storage/)).toBeInTheDocument()
    })
    await user.click(screen.getByText(/Next: Configure Storage/))
    await waitFor(() => {
      expect(screen.getByText('Storage Backend Configuration')).toBeInTheDocument()
    })
  }

  // Step 2 -> 3: save Storage then click Next
  if (stepIndex >= 3) {
    saveSetupStorageConfigMock.mockResolvedValue({ message: 'ok', config: {} })
    await user.click(screen.getByRole('button', { name: /Save Storage Configuration/i }))
    await waitFor(() => {
      expect(screen.getByText(/Next: Security Scanning/)).toBeInTheDocument()
    })
    await user.click(screen.getByText(/Next: Security Scanning/))
    await waitFor(() => {
      expect(screen.getByLabelText(/Enable security scanning/i)).toBeInTheDocument()
    })
  }

  return user
}

// Allow generous timeout for tests that navigate through multiple wizard steps
const STEP3_TIMEOUT = 30_000

describe('SetupWizardPage — Security Scanning step', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSetupStatusMock.mockResolvedValue({
      setup_required: true,
      storage_configured: false,
      setup_completed: false,
    })
  })

  // ── Stepper rendering ──

  it('renders all 6 steps in the stepper', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Authenticate')).toBeInTheDocument()
    })

    expect(screen.getByText('Identity Provider')).toBeInTheDocument()
    expect(screen.getByText('Storage Backend')).toBeInTheDocument()
    expect(screen.getByText('Security Scanning')).toBeInTheDocument()
    expect(screen.getByText('Admin User')).toBeInTheDocument()
    expect(screen.getByText('Complete')).toBeInTheDocument()
  })

  it('has exactly 6 step labels in the stepper', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Authenticate')).toBeInTheDocument()
    })

    const stepLabels = [
      'Authenticate',
      'Identity Provider',
      'Storage Backend',
      'Security Scanning',
      'Admin User',
      'Complete',
    ]
    for (const label of stepLabels) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  // ── Basic navigation ──

  it('starts on the Authenticate step (step 0)', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Setup Token/i })).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Verify Token' })).toBeInTheDocument()
  })

  it('advances to OIDC step after token validation', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Setup Token/i })).toBeInTheDocument()
    })

    await advanceToStep(1)

    expect(screen.getByRole('heading', { name: 'Identity Provider' })).toBeInTheDocument()
  })

  it('includes Security Scanning in the stepper while on step 0', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Security Scanning')).toBeInTheDocument()
    })
  })

  // ── Scanning step navigation ──

  it('navigates from Storage to Security Scanning step', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Setup Token/i })).toBeInTheDocument()
    })

    await advanceToStep(3)

    expect(screen.getByLabelText(/Enable security scanning/i)).toBeInTheDocument()
  }, STEP3_TIMEOUT)

  // ── Scanning skip ──

  it('shows Skip button when scanning is disabled', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Setup Token/i })).toBeInTheDocument()
    })

    await advanceToStep(3)

    expect(screen.getByRole('button', { name: /Skip/i })).toBeInTheDocument()
  }, STEP3_TIMEOUT)

  it('skipping scanning advances to Admin step', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Setup Token/i })).toBeInTheDocument()
    })

    const user = await advanceToStep(3)

    await user.click(screen.getByRole('button', { name: /Skip/i }))

    await waitFor(() => {
      expect(screen.getByText('Initial Admin User')).toBeInTheDocument()
    })
  }, STEP3_TIMEOUT)

  // ── Scanning enable/toggle ──

  it('hides Skip button when scanning is enabled', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Setup Token/i })).toBeInTheDocument()
    })

    const user = await advanceToStep(3)

    const toggle = screen.getByLabelText(/Enable security scanning/i)
    await user.click(toggle)

    expect(screen.queryByRole('button', { name: /^Skip$/i })).not.toBeInTheDocument()
  }, STEP3_TIMEOUT)

  it('shows scanning fields when enabled', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Setup Token/i })).toBeInTheDocument()
    })

    const user = await advanceToStep(3)

    const toggle = screen.getByLabelText(/Enable security scanning/i)
    await user.click(toggle)

    // MUI Select renders label text in multiple places; use getAllByText
    await waitFor(() => {
      expect(screen.getAllByText(/Scanning Tool/i).length).toBeGreaterThan(0)
    })
    expect(screen.getByLabelText(/Binary Path/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Severity Threshold/i)).toBeInTheDocument()
    // Verify Test and Save buttons are present
    expect(screen.getByRole('button', { name: /Test Configuration/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save Scanning Configuration/i })).toBeInTheDocument()
  }, STEP3_TIMEOUT)

  // ── Scanning test ──

  it('calls testScanningConfig when Test Configuration is clicked', async () => {
    testScanningConfigMock.mockResolvedValue({
      success: true,
      message: 'Trivy found and working',
      tool: 'trivy',
      version: '0.50.0',
    })

    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Setup Token/i })).toBeInTheDocument()
    })

    const user = await advanceToStep(3)
    await user.click(screen.getByLabelText(/Enable security scanning/i))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Test Configuration/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Test Configuration/i }))

    await waitFor(() => {
      expect(testScanningConfigMock).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(screen.getByText(/Trivy found and working/)).toBeInTheDocument()
    })
  }, STEP3_TIMEOUT)

  it('displays version info on successful test', async () => {
    testScanningConfigMock.mockResolvedValue({
      success: true,
      message: 'Trivy found and working',
      tool: 'trivy',
      version: '0.50.0',
    })

    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Setup Token/i })).toBeInTheDocument()
    })

    const user = await advanceToStep(3)
    await user.click(screen.getByLabelText(/Enable security scanning/i))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Test Configuration/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /Test Configuration/i }))

    await waitFor(() => {
      expect(screen.getByText(/Detected version: 0\.50\.0/)).toBeInTheDocument()
    })
  }, STEP3_TIMEOUT)

  it('shows error when scanning test fails', async () => {
    testScanningConfigMock.mockResolvedValue({
      success: false,
      message: 'trivy binary not found',
    })

    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Setup Token/i })).toBeInTheDocument()
    })

    const user = await advanceToStep(3)
    await user.click(screen.getByLabelText(/Enable security scanning/i))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Test Configuration/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /Test Configuration/i }))

    // The error message appears in both the scanning result area and the top-level alert
    await waitFor(() => {
      expect(screen.getAllByText(/trivy binary not found/).length).toBeGreaterThan(0)
    })
  }, STEP3_TIMEOUT)

  // ── Scanning save ──

  it('enables Save button only after successful test', async () => {
    testScanningConfigMock.mockResolvedValue({
      success: true,
      message: 'Scanner OK',
      tool: 'trivy',
      version: '0.50.0',
    })
    saveScanningConfigMock.mockResolvedValue({ message: 'Scanning configured' })

    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Setup Token/i })).toBeInTheDocument()
    })

    const user = await advanceToStep(3)
    await user.click(screen.getByLabelText(/Enable security scanning/i))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save Scanning Configuration/i })).toBeInTheDocument()
    })

    // Save should be disabled before test
    expect(screen.getByRole('button', { name: /Save Scanning Configuration/i })).toBeDisabled()

    // Run test
    await user.click(screen.getByRole('button', { name: /Test Configuration/i }))
    await waitFor(() => {
      expect(screen.getByText(/Scanner OK/)).toBeInTheDocument()
    })

    // Now Save should be enabled
    expect(screen.getByRole('button', { name: /Save Scanning Configuration/i })).toBeEnabled()
  }, STEP3_TIMEOUT)

  it('calls saveScanningConfig and shows Next button after save', async () => {
    testScanningConfigMock.mockResolvedValue({
      success: true,
      message: 'Scanner OK',
      tool: 'trivy',
      version: '0.50.0',
    })
    saveScanningConfigMock.mockResolvedValue({ message: 'Scanning configured' })

    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Setup Token/i })).toBeInTheDocument()
    })

    const user = await advanceToStep(3)
    await user.click(screen.getByLabelText(/Enable security scanning/i))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Test Configuration/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /Test Configuration/i }))
    await waitFor(() => {
      expect(screen.getByText(/Scanner OK/)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Save Scanning Configuration/i }))

    await waitFor(() => {
      expect(saveScanningConfigMock).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(screen.getByText(/Next: Configure Admin/)).toBeInTheDocument()
    })
  }, STEP3_TIMEOUT)

  // ── Back navigation ──

  it('Back button on scanning step goes to Storage step', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Setup Token/i })).toBeInTheDocument()
    })

    const user = await advanceToStep(3)

    const backButton = screen.getByRole('button', { name: /Back/i })
    await user.click(backButton)

    await waitFor(() => {
      expect(screen.getByText('Storage Backend Configuration')).toBeInTheDocument()
    })
  }, STEP3_TIMEOUT)

  // ── Setup status with scanning_configured ──

  it('redirects to / when setup is already completed', async () => {
    getSetupStatusMock.mockResolvedValue({
      setup_required: false,
      storage_configured: true,
      scanning_configured: true,
      setup_completed: true,
    })

    renderPage()

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
    })
  })
})
