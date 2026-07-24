import { render, act, waitFor, renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SetupWizardProvider, useSetupWizard } from '../SetupWizardContext'
import React from 'react'

const mockApi = vi.hoisted(() => ({
  getSetupStatus: vi.fn(),
  validateSetupToken: vi.fn(),
  testOIDCConfig: vi.fn(),
  saveOIDCConfig: vi.fn(),
  testLDAPConfig: vi.fn(),
  saveLDAPConfig: vi.fn(),
  testSetupStorageConfig: vi.fn(),
  saveSetupStorageConfig: vi.fn(),
  testScanningConfig: vi.fn(),
  saveScanningConfig: vi.fn(),
  installScanningTool: vi.fn(),
  configureAdmin: vi.fn(),
  completeSetup: vi.fn(),
}))

vi.mock('../../services/api', () => ({ default: mockApi }))

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SetupWizardProvider onSetupCompleted={() => {}} onSetupFinalized={() => {}}>
      {children}
    </SetupWizardProvider>
  )
}

describe('SetupWizardContext (roadmap 1.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.getSetupStatus.mockResolvedValue({ setup_completed: false })
  })

  it('throws when used outside provider', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useSetupWizard())).toThrow(
      /must be used within a SetupWizardProvider/,
    )
    err.mockRestore()
  })

  it('reloadStatus loads initial status and does not redirect on incomplete setup', async () => {
    const { result } = renderHook(() => useSetupWizard(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockApi.getSetupStatus).toHaveBeenCalled()
    expect(result.current.setupStatus?.setup_completed).toBe(false)
    expect(result.current.activeStep).toBe(0)
  })

  it('redirects via onSetupCompleted when setup already complete', async () => {
    mockApi.getSetupStatus.mockResolvedValue({ setup_completed: true })
    const onCompleted = vi.fn()
    render(
      <SetupWizardProvider onSetupCompleted={onCompleted} onSetupFinalized={() => {}}>
        <div />
      </SetupWizardProvider>,
    )
    await waitFor(() => expect(onCompleted).toHaveBeenCalled())
  })

  it('goToStep updates activeStep and clears error/success', async () => {
    const { result } = renderHook(() => useSetupWizard(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => {
      result.current.setError('err')
      result.current.setSuccess('ok')
    })
    act(() => {
      result.current.goToStep(3)
    })
    expect(result.current.activeStep).toBe(3)
    expect(result.current.error).toBeNull()
    expect(result.current.success).toBeNull()
  })

  it('validateToken advances to step 1 on success', async () => {
    mockApi.validateSetupToken.mockResolvedValue({ valid: true })
    const { result } = renderHook(() => useSetupWizard(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => {
      result.current.setSetupToken('tfr_setup_abc')
    })
    await act(async () => {
      await result.current.validateToken()
    })
    expect(result.current.tokenValid).toBe(true)
    expect(result.current.activeStep).toBe(1)
  })

  it('validateToken surfaces error on invalid token', async () => {
    mockApi.validateSetupToken.mockRejectedValue(new Error('bad token'))
    const { result } = renderHook(() => useSetupWizard(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => {
      result.current.setSetupToken('bad')
    })
    await act(async () => {
      await result.current.validateToken()
    })
    expect(result.current.tokenValid).toBe(false)
    expect(result.current.error).toBeTruthy()
  })

  it('changeStorageBackend resets form per backend type', async () => {
    const { result } = renderHook(() => useSetupWizard(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => {
      result.current.changeStorageBackend('s3')
    })
    expect(result.current.storageForm.backend_type).toBe('s3')
    expect(result.current.storageForm.s3_region).toBe('')
    expect(result.current.storageForm.s3_auth_method).toBe('access_key')
    act(() => {
      result.current.changeStorageBackend('gcs')
    })
    expect(result.current.storageForm.backend_type).toBe('gcs')
    expect(result.current.storageForm.gcs_auth_method).toBe('credentials_file')
  })

  it('saveOIDC flips oidcSaved on success', async () => {
    mockApi.saveOIDCConfig.mockResolvedValue({})
    const { result } = renderHook(() => useSetupWizard(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.saveOIDC()
    })
    expect(result.current.oidcSaved).toBe(true)
    expect(result.current.success).toMatch(/OIDC/i)
  })

  it('installScanner updates binary_path and sets result on success', async () => {
    mockApi.installScanningTool.mockResolvedValue({
      success: true,
      tool: 'trivy',
      version: '0.58.0',
      binary_path: '/app/scanners/trivy',
      sha256: 'abc123',
      source_url: 'https://example.com',
    })
    const { result } = renderHook(() => useSetupWizard(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.installScanner()
    })
    expect(result.current.scanningInstallResult?.success).toBe(true)
    expect(result.current.scanningForm.binary_path).toBe('/app/scanners/trivy')
    expect(result.current.scanningInstalling).toBe(false)
  })

  it('installScanner sets error on failure', async () => {
    mockApi.installScanningTool.mockResolvedValue({
      success: false,
      tool: 'trivy',
      version: '',
      binary_path: '',
      sha256: '',
      source_url: '',
      error: 'no matching asset',
    })
    const { result } = renderHook(() => useSetupWizard(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.installScanner()
    })
    expect(result.current.scanningInstallResult?.success).toBe(false)
    expect(result.current.error).toMatch(/no matching asset/)
  })

  it('installScanner handles network error', async () => {
    mockApi.installScanningTool.mockRejectedValue(new Error('network error'))
    const { result } = renderHook(() => useSetupWizard(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.installScanner()
    })
    expect(result.current.error).toBeTruthy()
    expect(result.current.scanningInstalling).toBe(false)
  })

  // ─── #601 sibling: test/install result strings arrive on a 2xx body and skip
  // getErrorMessage's AxiosError sanitization. They are surfaced BOTH via setError
  // AND rendered directly by the step components (OIDCStep/StorageStep/ScanningStep),
  // so the context sanitizes them at the trust boundary before storing. ────────────

  it('testOIDC routes a leaked backend message away from both the banner and the stored result (#601)', async () => {
    mockApi.testOIDCConfig.mockResolvedValue({
      success: false,
      message: 'dial tcp 10.0.5.23:5432: connect: connection refused',
    })
    const { result } = renderHook(() => useSetupWizard(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.testOIDC()
    })
    // Shared error banner is sanitized...
    expect(result.current.error).not.toContain('10.0.5.23')
    expect(result.current.error).toBe('OIDC test failed')
    // ...and so is the result OIDCStep renders inline (oidcTestResult.message).
    expect(result.current.oidcTestResult?.message).not.toContain('10.0.5.23')
    expect(result.current.oidcTestResult?.message).toBe('OIDC test failed')
  })

  it('testOIDC preserves a short, clean backend failure message', async () => {
    mockApi.testOIDCConfig.mockResolvedValue({ success: false, message: 'Invalid issuer URL' })
    const { result } = renderHook(() => useSetupWizard(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.testOIDC()
    })
    expect(result.current.error).toBe('Invalid issuer URL')
    expect(result.current.oidcTestResult?.message).toBe('Invalid issuer URL')
  })

  it('testScanning routes a leaked backend message through sanitization (#601)', async () => {
    mockApi.testScanningConfig.mockResolvedValue({
      success: false,
      message: 'open /var/lib/registry/scanners/trivy: permission denied',
    })
    const { result } = renderHook(() => useSetupWizard(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.testScanning()
    })
    expect(result.current.error).not.toContain('/var/lib/registry')
    expect(result.current.scanningTestResult?.message).not.toContain('/var/lib/registry')
    expect(result.current.scanningTestResult?.message).toBe('Scanning test failed')
  })

  it('testLDAP routes a leaked backend message away from both the banner and the stored result (#601)', async () => {
    mockApi.testLDAPConfig.mockResolvedValue({
      success: false,
      message: 'dial tcp 10.0.5.23:389: connect: connection refused',
    })
    const { result } = renderHook(() => useSetupWizard(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.testLDAP()
    })
    // Shared error banner is sanitized...
    expect(result.current.error).not.toContain('10.0.5.23')
    expect(result.current.error).toBe('LDAP test failed')
    // ...and so is the result OIDCStep (auth step) renders inline (ldapTestResult.message).
    expect(result.current.ldapTestResult?.message).not.toContain('10.0.5.23')
    expect(result.current.ldapTestResult?.message).toBe('LDAP test failed')
  })

  it('testLDAP preserves a short, clean backend failure message', async () => {
    mockApi.testLDAPConfig.mockResolvedValue({ success: false, message: 'Invalid bind credentials' })
    const { result } = renderHook(() => useSetupWizard(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.testLDAP()
    })
    expect(result.current.error).toBe('Invalid bind credentials')
    expect(result.current.ldapTestResult?.message).toBe('Invalid bind credentials')
  })

  it('testStorage routes a leaked backend message away from both the banner and the stored result (#601)', async () => {
    mockApi.testSetupStorageConfig.mockResolvedValue({
      success: false,
      message: 'open /storage/local/uploads/tmp-9f3: permission denied',
    })
    const { result } = renderHook(() => useSetupWizard(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.testStorage()
    })
    // A failed test must NOT trigger a save of the (leaked) config.
    expect(mockApi.saveSetupStorageConfig).not.toHaveBeenCalled()
    // Shared banner is sanitized...
    expect(result.current.error).not.toContain('/storage/local')
    expect(result.current.error).toBe('Storage test failed')
    // ...and so is the result StorageStep renders inline (storageTestResult.message).
    expect(result.current.storageTestResult?.message).not.toContain('/storage/local')
    expect(result.current.storageTestResult?.message).toBe('Storage test failed')
  })

  it('testStorage preserves a short, clean backend failure message', async () => {
    mockApi.testSetupStorageConfig.mockResolvedValue({
      success: false,
      message: 'Bucket does not exist',
    })
    const { result } = renderHook(() => useSetupWizard(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.testStorage()
    })
    expect(result.current.error).toBe('Bucket does not exist')
    expect(result.current.storageTestResult?.message).toBe('Bucket does not exist')
  })

  it('installScanner routes a leaked error away from both the banner and the stored result (#601)', async () => {
    mockApi.installScanningTool.mockResolvedValue({
      success: false,
      tool: 'trivy',
      version: '',
      binary_path: '',
      sha256: '',
      source_url: '',
      error: 'open /var/lib/registry/scanners/trivy.tmp: permission denied',
    })
    const { result } = renderHook(() => useSetupWizard(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.installScanner()
    })
    // ScanningStep renders scanningInstallResult.error directly, so the stored
    // value must also be sanitized — not just the banner.
    expect(result.current.error).not.toContain('/var/lib/registry')
    expect(result.current.error).toBe('Scanner installation failed')
    expect(result.current.scanningInstallResult?.error).not.toContain('/var/lib/registry')
    expect(result.current.scanningInstallResult?.error).toBe('Scanner installation failed')
  })
})
