import { http } from './http'
import type { VersionInfo } from '../../types'

// ============================================================================
// Version
// ============================================================================

export async function getVersionInfo(): Promise<VersionInfo> {
  const response = await http.get<VersionInfo>('/version')
  return response.data
}
