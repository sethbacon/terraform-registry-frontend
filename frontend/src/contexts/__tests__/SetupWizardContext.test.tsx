import { render, act, waitFor, renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SetupWizardProvider, useSetupWizard } from '../SetupWizardContext';
import React from 'react';

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
  configureAdmin: vi.fn(),
  completeSetup: vi.fn(),
}));

vi.mock('../../services/api', () => ({ default: mockApi }));

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SetupWizardProvider onSetupCompleted={() => { }} onSetupFinalized={() => { }}>
      {children}
    </SetupWizardProvider>
  );
}

describe('SetupWizardContext (roadmap 1.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getSetupStatus.mockResolvedValue({ setup_completed: false });
  });

  it('throws when used outside provider', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => { });
    expect(() => renderHook(() => useSetupWizard())).toThrow(/must be used within a SetupWizardProvider/);
    err.mockRestore();
  });

  it('reloadStatus loads initial status and does not redirect on incomplete setup', async () => {
    const { result } = renderHook(() => useSetupWizard(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockApi.getSetupStatus).toHaveBeenCalled();
    expect(result.current.setupStatus?.setup_completed).toBe(false);
    expect(result.current.activeStep).toBe(0);
  });

  it('redirects via onSetupCompleted when setup already complete', async () => {
    mockApi.getSetupStatus.mockResolvedValue({ setup_completed: true });
    const onCompleted = vi.fn();
    render(
      <SetupWizardProvider onSetupCompleted={onCompleted} onSetupFinalized={() => { }}>
        <div />
      </SetupWizardProvider>,
    );
    await waitFor(() => expect(onCompleted).toHaveBeenCalled());
  });

  it('goToStep updates activeStep and clears error/success', async () => {
    const { result } = renderHook(() => useSetupWizard(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setError('err'); result.current.setSuccess('ok'); });
    act(() => { result.current.goToStep(3); });
    expect(result.current.activeStep).toBe(3);
    expect(result.current.error).toBeNull();
    expect(result.current.success).toBeNull();
  });

  it('validateToken advances to step 1 on success', async () => {
    mockApi.validateSetupToken.mockResolvedValue({ valid: true });
    const { result } = renderHook(() => useSetupWizard(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setSetupToken('tfr_setup_abc'); });
    await act(async () => { await result.current.validateToken(); });
    expect(result.current.tokenValid).toBe(true);
    expect(result.current.activeStep).toBe(1);
  });

  it('validateToken surfaces error on invalid token', async () => {
    mockApi.validateSetupToken.mockRejectedValue(new Error('bad token'));
    const { result } = renderHook(() => useSetupWizard(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setSetupToken('bad'); });
    await act(async () => { await result.current.validateToken(); });
    expect(result.current.tokenValid).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it('changeStorageBackend resets form per backend type', async () => {
    const { result } = renderHook(() => useSetupWizard(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.changeStorageBackend('s3'); });
    expect(result.current.storageForm.backend_type).toBe('s3');
    expect(result.current.storageForm.s3_region).toBe('');
    expect(result.current.storageForm.s3_auth_method).toBe('access_key');
    act(() => { result.current.changeStorageBackend('gcs'); });
    expect(result.current.storageForm.backend_type).toBe('gcs');
    expect(result.current.storageForm.gcs_auth_method).toBe('credentials_file');
  });

  it('saveOIDC flips oidcSaved on success', async () => {
    mockApi.saveOIDCConfig.mockResolvedValue({});
    const { result } = renderHook(() => useSetupWizard(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.saveOIDC(); });
    expect(result.current.oidcSaved).toBe(true);
    expect(result.current.success).toMatch(/OIDC/i);
  });
});
