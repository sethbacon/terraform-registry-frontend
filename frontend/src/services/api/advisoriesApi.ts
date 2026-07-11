import { http } from './http'
import type { CVEAdvisory, CVEAdvisoryAdmin } from '../../types'

// ============================================================================
// CVE Advisories
// ============================================================================

/** Public endpoint — returns active advisories; cached 5 min by the backend. */
export async function getActiveAdvisories(): Promise<CVEAdvisory[]> {
  const response = await http.get<CVEAdvisory[]>('/api/v1/advisories/active')
  return Array.isArray(response.data) ? response.data : []
}

/** Admin endpoint — returns all advisories (including withdrawn), with optional kind filter. */
export async function listAdminAdvisories(
  kind?: 'binary' | 'provider' | 'scanner',
): Promise<{ advisories: CVEAdvisoryAdmin[]; total: number }> {
  const response = await http.get('/api/v1/admin/advisories', {
    params: kind ? { kind } : undefined,
  })
  return response.data
}

/** Admin endpoint — queues an immediate CVE poll outside the normal schedule. */
export async function triggerAdvisoryPoll(): Promise<{ message: string }> {
  const response = await http.post('/api/v1/admin/advisories/poll')
  return response.data
}
