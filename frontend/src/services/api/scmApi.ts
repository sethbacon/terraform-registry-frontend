import { http } from './http'
import type {
  ModuleSCMLink,
  SCMBranch,
  SCMProvider,
  SCMRepository,
  SCMTag,
  SCMWebhookEvent,
} from '../../types/scm'

// SCM Provider Management
export async function listSCMProviders(organizationId?: string): Promise<SCMProvider[] | null> {
  const params = organizationId ? { organization_id: organizationId } : {}
  const response = await http.get('/api/v1/scm-providers', { params })
  return response.data
}

export async function createSCMProvider(data: {
  organization_id: string
  provider_type: string
  name: string
  base_url?: string | null
  tenant_id?: string | null
  client_id?: string
  client_secret?: string
  webhook_secret?: string
  auth_mode?: string
  github_app_id?: string
  github_installation_id?: string
  app_private_key?: string
}): Promise<SCMProvider> {
  const response = await http.post('/api/v1/scm-providers', data)
  return response.data
}

export async function getSCMProvider(id: string): Promise<SCMProvider> {
  const response = await http.get(`/api/v1/scm-providers/${id}`)
  return response.data
}

export async function updateSCMProvider(
  id: string,
  data: {
    name?: string
    base_url?: string | null
    tenant_id?: string | null
    client_id?: string
    client_secret?: string
    webhook_secret?: string
    is_active?: boolean
    auth_mode?: string
    github_app_id?: string
    github_installation_id?: string
    app_private_key?: string
  },
): Promise<SCMProvider> {
  const response = await http.put(`/api/v1/scm-providers/${id}`, data)
  return response.data
}

export async function deleteSCMProvider(id: string): Promise<{ message: string }> {
  const response = await http.delete(`/api/v1/scm-providers/${id}`)
  return response.data
}

// Verify a provider's shared app credentials by minting a token (app auth modes only)
export async function verifySCMProvider(
  providerId: string,
): Promise<{ ok: boolean; expires_at?: string | null }> {
  const response = await http.post(`/api/v1/scm-providers/${providerId}/verify`)
  return response.data
}

// SCM OAuth
export async function initiateSCMOAuth(providerId: string) {
  const response = await http.get(`/api/v1/scm-providers/${providerId}/oauth/authorize`)
  return response.data
}

export async function refreshSCMToken(
  providerId: string,
): Promise<{ message: string; expires_at?: string }> {
  const response = await http.post(`/api/v1/scm-providers/${providerId}/oauth/refresh`)
  return response.data
}

export async function getSCMTokenStatus(providerId: string): Promise<{
  connected: boolean
  connected_at?: string
  expires_at?: string | null
  token_type?: string
}> {
  const response = await http.get(`/api/v1/scm-providers/${providerId}/oauth/token`)
  return response.data
}

export async function listSCMRepositories(
  providerId: string,
  search?: string,
): Promise<{ repositories: SCMRepository[] | null }> {
  const params = search ? { search } : {}
  const response = await http.get(`/api/v1/scm-providers/${providerId}/repositories`, {
    params,
  })
  return response.data
}

export async function listSCMRepositoryTags(
  providerId: string,
  owner: string,
  repo: string,
): Promise<{ tags: SCMTag[] | null }> {
  const response = await http.get<{ tags: SCMTag[] | null }>(
    `/api/v1/scm-providers/${providerId}/repositories/${owner}/${repo}/tags`,
  )
  return response.data
}

export async function listSCMRepositoryBranches(
  providerId: string,
  owner: string,
  repo: string,
): Promise<{ branches: SCMBranch[] | null }> {
  const response = await http.get<{ branches: SCMBranch[] | null }>(
    `/api/v1/scm-providers/${providerId}/repositories/${owner}/${repo}/branches`,
  )
  return response.data
}

export async function revokeSCMToken(providerId: string): Promise<{ message: string }> {
  const response = await http.delete(`/api/v1/scm-providers/${providerId}/oauth/token`)
  return response.data
}

export async function saveSCMToken(
  providerId: string,
  accessToken: string,
): Promise<{ message: string }> {
  const response = await http.post(`/api/v1/scm-providers/${providerId}/token`, {
    access_token: accessToken,
  })
  return response.data
}

// Module SCM Linking
export async function linkModuleToSCM(
  moduleId: string,
  data: {
    provider_id: string
    repository_owner: string
    repository_name: string
    repository_path?: string
    default_branch?: string
    auto_publish_enabled?: boolean
    tag_pattern?: string
  },
): Promise<{
  message: string
  link_id: string
  webhook_callback_url: string
  webhook_registered: boolean
  note: string
}> {
  const response = await http.post(`/api/v1/admin/modules/${moduleId}/scm`, data)
  return response.data
}

export async function getModuleSCMInfo(moduleId: string): Promise<ModuleSCMLink> {
  const response = await http.get<ModuleSCMLink>(`/api/v1/admin/modules/${moduleId}/scm`)
  return response.data
}

export async function updateModuleSCMLink(
  moduleId: string,
  data: {
    repository_path?: string
    default_branch?: string
    auto_publish_enabled?: boolean
    tag_pattern?: string
  },
): Promise<{ message: string }> {
  const response = await http.put(`/api/v1/admin/modules/${moduleId}/scm`, data)
  return response.data
}

export async function unlinkModuleFromSCM(moduleId: string): Promise<{ message: string }> {
  const response = await http.delete(`/api/v1/admin/modules/${moduleId}/scm`)
  return response.data
}

export async function triggerManualSync(
  moduleId: string,
  data?: { tag_name?: string; commit_sha?: string },
): Promise<{ message: string }> {
  const response = await http.post(`/api/v1/admin/modules/${moduleId}/scm/sync`, data || {})
  return response.data
}

export async function getWebhookEvents(moduleId: string): Promise<SCMWebhookEvent[]> {
  const response = await http.get<{ events?: SCMWebhookEvent[] }>(
    `/api/v1/admin/modules/${moduleId}/scm/events`,
  )
  // Backend wraps the list as { events: [...] }; callers expect a bare array.
  return response.data?.events ?? []
}
