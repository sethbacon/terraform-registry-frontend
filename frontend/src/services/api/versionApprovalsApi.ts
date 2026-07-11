import { http } from './http'
import type {
  VersionApprovalBulkResponse,
  VersionApprovalEvent,
  VersionApprovalListResponse,
} from '../../types/version_approval'

// ============================================================================
// Version Approvals
// ============================================================================

export async function listVersionApprovals(params?: {
  type?: 'provider' | 'terraform' | 'scanner'
  status?: 'pending_approval' | 'approved' | 'rejected'
  config_id?: string
  limit?: number
  offset?: number
}): Promise<VersionApprovalListResponse> {
  const queryParams: Record<string, string | number> = {}
  if (params?.type) queryParams.type = params.type
  if (params?.status) queryParams.status = params.status
  if (params?.config_id) queryParams.config_id = params.config_id
  if (params?.limit) queryParams.limit = params.limit
  if (params?.offset) queryParams.offset = params.offset
  const response = await http.get('/api/v1/admin/version-approvals', {
    params: queryParams,
  })
  return response.data
}

export async function approveVersion(id: string, data?: { notes?: string }): Promise<void> {
  await http.put(`/api/v1/admin/version-approvals/${id}/approve`, data ?? {})
}

export async function rejectVersion(id: string, data?: { notes?: string }): Promise<void> {
  await http.put(`/api/v1/admin/version-approvals/${id}/reject`, data ?? {})
}

export async function bulkApproveVersions(
  ids: string[],
  notes?: string,
): Promise<VersionApprovalBulkResponse> {
  const response = await http.post('/api/v1/admin/version-approvals/bulk-approve', {
    ids,
    notes,
  })
  return response.data
}

export async function bulkRejectVersions(
  ids: string[],
  notes?: string,
): Promise<VersionApprovalBulkResponse> {
  const response = await http.post('/api/v1/admin/version-approvals/bulk-reject', {
    ids,
    notes,
  })
  return response.data
}

export async function getVersionApprovalEvents(id: string): Promise<VersionApprovalEvent[]> {
  const response = await http.get<VersionApprovalEvent[]>(
    `/api/v1/admin/version-approvals/${id}/events`,
  )
  return Array.isArray(response.data) ? response.data : []
}

export async function getPendingVersionApprovalCount(): Promise<{ count: number }> {
  const response = await http.get('/api/v1/admin/version-approvals/pending-count')
  return response.data
}
