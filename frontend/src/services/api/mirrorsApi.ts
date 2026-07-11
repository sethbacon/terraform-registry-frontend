import { http } from './http'
import type {
  CreateMirrorConfigRequest,
  MirrorConfiguration,
  MirrorSyncStatus,
  MirroredProvider,
  UpdateMirrorConfigRequest,
} from '../../types/mirror'
import type { MirrorApprovalRequest, MirrorPolicy } from '../../types/rbac'

// Mirror Management
export async function listMirrors(enabledOnly = false): Promise<MirrorConfiguration[]> {
  const params = enabledOnly ? { enabled: 'true' } : {}
  const response = await http.get<{ mirrors?: MirrorConfiguration[] }>('/api/v1/admin/mirrors', {
    params,
  })
  return response.data.mirrors || []
}

export async function getMirror(id: string): Promise<MirrorConfiguration> {
  const response = await http.get<MirrorConfiguration>(`/api/v1/admin/mirrors/${id}`)
  return response.data
}

export async function createMirror(data: CreateMirrorConfigRequest): Promise<MirrorConfiguration> {
  const response = await http.post<MirrorConfiguration>('/api/v1/admin/mirrors', data)
  return response.data
}

export async function updateMirror(
  id: string,
  data: UpdateMirrorConfigRequest,
): Promise<MirrorConfiguration> {
  const response = await http.put<MirrorConfiguration>(`/api/v1/admin/mirrors/${id}`, data)
  return response.data
}

export async function deleteMirror(id: string): Promise<{ message: string }> {
  const response = await http.delete<{ message: string }>(`/api/v1/admin/mirrors/${id}`)
  return response.data
}

export async function triggerMirrorSync(
  id: string,
  data?: { namespace?: string; provider_name?: string },
): Promise<{ message: string }> {
  const response = await http.post<{ message: string }>(
    `/api/v1/admin/mirrors/${id}/sync`,
    data || {},
  )
  return response.data
}

export async function getMirrorStatus(id: string): Promise<MirrorSyncStatus> {
  const response = await http.get<MirrorSyncStatus>(`/api/v1/admin/mirrors/${id}/status`)
  return response.data
}

export async function getMirrorProviders(id: string): Promise<MirroredProvider[]> {
  const response = await http.get<{ providers?: MirroredProvider[] }>(
    `/api/v1/admin/mirrors/${id}/providers`,
  )
  return response.data.providers ?? []
}

// ============================================================================
// Mirror Approval Requests
// ============================================================================

export async function listApprovalRequests(options?: {
  organization_id?: string
  status?: string
}): Promise<MirrorApprovalRequest[]> {
  const params: Record<string, string> = {}
  if (options?.organization_id) params.organization_id = options.organization_id
  if (options?.status) params.status = options.status
  const response = await http.get<MirrorApprovalRequest[]>('/api/v1/admin/approvals', { params })
  return response.data || []
}

export async function getApprovalRequest(id: string): Promise<MirrorApprovalRequest> {
  const response = await http.get<MirrorApprovalRequest>(`/api/v1/admin/approvals/${id}`)
  return response.data
}

export async function createApprovalRequest(data: {
  mirror_config_id: string
  provider_namespace: string
  provider_name?: string
  reason?: string
}): Promise<MirrorApprovalRequest> {
  const response = await http.post<MirrorApprovalRequest>('/api/v1/admin/approvals', data)
  return response.data
}

export async function reviewApproval(
  id: string,
  data: { status: 'approved' | 'rejected'; notes?: string },
): Promise<MirrorApprovalRequest> {
  const response = await http.put<MirrorApprovalRequest>(
    `/api/v1/admin/approvals/${id}/review`,
    data,
  )
  return response.data
}

// ============================================================================
// Mirror Policies
// ============================================================================

export async function listMirrorPolicies(organizationId?: string): Promise<MirrorPolicy[]> {
  const params = organizationId ? { organization_id: organizationId } : {}
  const response = await http.get<MirrorPolicy[]>('/api/v1/admin/policies', { params })
  return response.data || []
}

export async function getMirrorPolicy(id: string): Promise<MirrorPolicy> {
  const response = await http.get<MirrorPolicy>(`/api/v1/admin/policies/${id}`)
  return response.data
}

export async function createMirrorPolicy(data: {
  organization_id?: string
  name: string
  description?: string
  policy_type: 'allow' | 'deny'
  upstream_registry?: string
  namespace_pattern?: string
  provider_pattern?: string
  priority?: number
  is_active?: boolean
  requires_approval?: boolean
}): Promise<MirrorPolicy> {
  const response = await http.post<MirrorPolicy>('/api/v1/admin/policies', data)
  return response.data
}

export async function updateMirrorPolicy(
  id: string,
  data: {
    name?: string
    description?: string
    policy_type?: 'allow' | 'deny'
    upstream_registry?: string
    namespace_pattern?: string
    provider_pattern?: string
    priority?: number
    is_active?: boolean
    requires_approval?: boolean
  },
): Promise<MirrorPolicy> {
  const response = await http.put<MirrorPolicy>(`/api/v1/admin/policies/${id}`, data)
  return response.data
}

export async function deleteMirrorPolicy(id: string): Promise<{ message: string }> {
  const response = await http.delete<{ message: string }>(`/api/v1/admin/policies/${id}`)
  return response.data
}

export async function evaluateMirrorPolicy(
  data: {
    registry: string
    namespace: string
    provider: string
  },
  organizationId?: string,
) {
  const params = organizationId ? { organization_id: organizationId } : {}
  const response = await http.post('/api/v1/admin/policies/evaluate', data, { params })
  return response.data
}
