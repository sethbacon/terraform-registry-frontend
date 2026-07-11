/**
 * API Keys domain API — key listing, CRUD, and rotation.
 */
import { http } from './http'
import type { APIKey } from '../../types'

/**
 * Wire shape of POST /api/v1/apikeys (swagger: admin.CreateAPIKeyResponse).
 * `key` is the full secret and is only returned once, at creation time.
 */
export interface CreateAPIKeyResponse {
  id: string
  name: string
  description: string | null
  key: string
  key_prefix: string
  scopes: string[]
  expires_at: string | null
  created_at: string
}

// API Keys
export async function listAPIKeys(organizationId?: string): Promise<APIKey[]> {
  const response = await http.get('/api/v1/apikeys', {
    params: organizationId ? { organization_id: organizationId } : {},
  })

  const rawKeys = response.data?.keys || []

  // Normalize keys to frontend shape (support PascalCase from Go structs
  // or snake_case from explicit JSON mapping)
  const keys = rawKeys.map((k: Record<string, unknown>) => ({
    id: k.id || k.ID,
    user_id: k.user_id || k.UserID,
    user_name: k.user_name || k.UserName || null,
    organization_id: k.organization_id || k.OrganizationID,
    name: k.name || k.Name || '',
    description: k.description || k.Description || '',
    key_prefix: k.key_prefix || k.KeyPrefix || '',
    scopes: k.scopes || k.Scopes || [],
    expires_at: k.expires_at || k.ExpiresAt || null,
    last_used_at: k.last_used_at || k.LastUsedAt || null,
    created_at: k.created_at || k.CreatedAt || '',
  }))

  return keys
}

export async function createAPIKey(data: {
  name: string
  organization_id: string
  description?: string
  scopes: string[]
  expires_at?: string
}): Promise<CreateAPIKeyResponse> {
  const response = await http.post<CreateAPIKeyResponse>('/api/v1/apikeys', data)
  return response.data
}

export async function getAPIKey(id: string) {
  const response = await http.get(`/api/v1/apikeys/${id}`)
  return response.data
}

export async function updateAPIKey(
  id: string,
  data: { name?: string; scopes?: string[]; expires_at?: string },
) {
  const response = await http.put(`/api/v1/apikeys/${id}`, data)
  return response.data
}

export async function deleteAPIKey(id: string): Promise<{ message: string }> {
  const response = await http.delete<{ message: string }>(`/api/v1/apikeys/${id}`)
  return response.data
}

export async function rotateAPIKey(id: string, gracePeriodHours: number = 0) {
  const response = await http.post(`/api/v1/apikeys/${id}/rotate`, {
    grace_period_hours: gracePeriodHours,
  })
  return response.data
}
