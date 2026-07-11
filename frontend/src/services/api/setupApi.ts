import { http, setupRequest } from './http'
import type {
  CompleteSetupResponse,
  ConfigureAdminInput,
  ConfigureAdminResponse,
  LDAPConfigInput,
  OIDCConfigInput,
  OIDCConfigResponse,
  ScanningConfigInput,
  ScanningInstallRequest,
  ScanningInstallResult,
  ScanningTestResult,
  SetupStatus,
  SetupTestResult,
  SetupValidateTokenResponse,
  StorageConfigInput,
  StorageConfigResponse,
} from '../../types'

// ============================================================================
// Setup Wizard
// ============================================================================

export async function validateSetupToken(setupToken: string): Promise<SetupValidateTokenResponse> {
  const response = await http.post('/api/v1/setup/validate-token', {}, setupRequest(setupToken))
  return response.data
}

export async function testOIDCConfig(
  setupToken: string,
  data: OIDCConfigInput,
): Promise<SetupTestResult> {
  const response = await http.post('/api/v1/setup/oidc/test', data, setupRequest(setupToken))
  return response.data
}

export async function saveOIDCConfig(
  setupToken: string,
  data: OIDCConfigInput,
): Promise<OIDCConfigResponse> {
  const response = await http.post('/api/v1/setup/oidc', data, setupRequest(setupToken))
  return response.data
}

export async function testLDAPConfig(
  setupToken: string,
  data: LDAPConfigInput,
): Promise<SetupTestResult> {
  const response = await http.post('/api/v1/setup/ldap/test', data, setupRequest(setupToken))
  return response.data
}

export async function saveLDAPConfig(
  setupToken: string,
  data: LDAPConfigInput,
): Promise<{ message: string; host: string; port: number }> {
  const response = await http.post('/api/v1/setup/ldap', data, setupRequest(setupToken))
  return response.data
}

export async function testSetupStorageConfig(
  setupToken: string,
  data: StorageConfigInput,
): Promise<SetupTestResult> {
  const response = await http.post('/api/v1/setup/storage/test', data, setupRequest(setupToken))
  return response.data
}

export async function saveSetupStorageConfig(
  setupToken: string,
  data: StorageConfigInput,
): Promise<{ message: string; config: StorageConfigResponse }> {
  const response = await http.post('/api/v1/setup/storage', data, setupRequest(setupToken))
  return response.data
}

export async function testScanningConfig(
  setupToken: string,
  data: ScanningConfigInput,
): Promise<ScanningTestResult> {
  const response = await http.post('/api/v1/setup/scanning/test', data, setupRequest(setupToken))
  return response.data
}

export async function saveScanningConfig(
  setupToken: string,
  data: ScanningConfigInput,
): Promise<{ message: string }> {
  const response = await http.post('/api/v1/setup/scanning', data, setupRequest(setupToken))
  return response.data
}

export async function installScanningTool(
  setupToken: string,
  data: ScanningInstallRequest,
): Promise<ScanningInstallResult> {
  const response = await http.post('/api/v1/setup/scanning/install', data, setupRequest(setupToken))
  return response.data
}

export async function configureAdmin(
  setupToken: string,
  data: ConfigureAdminInput,
): Promise<ConfigureAdminResponse> {
  const response = await http.post('/api/v1/setup/admin', data, setupRequest(setupToken))
  return response.data
}

export async function completeSetup(setupToken: string): Promise<CompleteSetupResponse> {
  const response = await http.post('/api/v1/setup/complete', {}, setupRequest(setupToken))
  return response.data
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const response = await http.get('/api/v1/setup/status')
  return response.data
}
