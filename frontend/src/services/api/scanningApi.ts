import { http } from './http'
import type {
  ModuleScan,
  ScannerAutoUpdateInput,
  ScannerAutoUpdateSettings,
  ScannerInstallRequest,
  ScannerInstallResult,
  ScannerLatestInfo,
  ScanningConfig,
  ScanningStats,
} from '../../types'

export async function getModuleScan(
  namespace: string,
  name: string,
  system: string,
  version: string,
): Promise<ModuleScan> {
  const response = await http.get(
    `/api/v1/modules/${namespace}/${name}/${system}/versions/${version}/scan`,
  )
  return response.data
}

export async function getScanningConfig(): Promise<ScanningConfig> {
  const response = await http.get('/api/v1/admin/scanning/config')
  return response.data
}

export async function getScanningStats(params?: {
  status?: string
  limit?: number
  offset?: number
}): Promise<ScanningStats> {
  const response = await http.get('/api/v1/admin/scanning/stats', { params })
  return response.data
}

export async function getScanByID(scanID: string): Promise<ModuleScan> {
  const response = await http.get(`/api/v1/admin/scanning/scans/${scanID}`)
  return response.data
}

export async function checkScannerLatest(tool: string): Promise<ScannerLatestInfo> {
  const response = await http.get('/api/v1/admin/scanning/latest', { params: { tool } })
  return response.data
}

export async function adminInstallScanner(
  data: ScannerInstallRequest,
): Promise<ScannerInstallResult> {
  const response = await http.post('/api/v1/admin/scanning/install', data)
  return response.data
}

export async function triggerScannerCheck(): Promise<{ message: string }> {
  const response = await http.post('/api/v1/admin/scanning/check')
  return response.data
}

export async function saveScannerAutoUpdate(
  data: ScannerAutoUpdateInput,
): Promise<ScannerAutoUpdateSettings> {
  const response = await http.put('/api/v1/admin/scanning/auto-update', data)
  return response.data
}
