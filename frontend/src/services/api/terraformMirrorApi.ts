import { http } from './http'
import type {
  CreateTerraformMirrorConfigRequest,
  TerraformBinaryDownloadResponse,
  TerraformMirrorConfig,
  TerraformMirrorConfigListResponse,
  TerraformMirrorStatusResponse,
  TerraformSyncHistoryListResponse,
  TerraformVersion,
  TerraformVersionListResponse,
  TerraformVersionPlatform,
  UpdateTerraformMirrorConfigRequest,
} from '../../types/terraform_mirror'
import type { ReleasesGPGKeysResponse } from '../../types/releases_gpg_keys'

// ============================================================================
// Terraform Binary Mirror — Public list (no auth required)
// ============================================================================

export async function listPublicTerraformMirrorConfigs(): Promise<
  { name: string; description?: string | null; tool: string }[]
> {
  const response =
    await http.get<{ name: string; description?: string | null; tool: string }[]>(
      '/terraform/binaries',
    )
  return Array.isArray(response.data) ? response.data : []
}

// ============================================================================
// Terraform Binary Mirror — Admin Endpoints (multi-config)
// All config-scoped endpoints take a configId (UUID) as their first argument.
// ============================================================================

export async function listTerraformMirrorConfigs(): Promise<TerraformMirrorConfigListResponse> {
  const response = await http.get<TerraformMirrorConfigListResponse>(
    '/api/v1/admin/terraform-mirrors',
  )
  return response.data
}

export async function createTerraformMirrorConfig(
  data: CreateTerraformMirrorConfigRequest,
): Promise<TerraformMirrorConfig> {
  const response = await http.post<TerraformMirrorConfig>('/api/v1/admin/terraform-mirrors', data)
  return response.data
}

export async function getTerraformMirrorConfig(configId: string): Promise<TerraformMirrorConfig> {
  const response = await http.get<TerraformMirrorConfig>(
    `/api/v1/admin/terraform-mirrors/${configId}`,
  )
  return response.data
}

export async function getTerraformMirrorStatus(
  configId: string,
): Promise<TerraformMirrorStatusResponse> {
  const response = await http.get<TerraformMirrorStatusResponse>(
    `/api/v1/admin/terraform-mirrors/${configId}/status`,
  )
  return response.data
}

export async function updateTerraformMirrorConfig(
  configId: string,
  data: UpdateTerraformMirrorConfigRequest,
): Promise<TerraformMirrorConfig> {
  const response = await http.put<TerraformMirrorConfig>(
    `/api/v1/admin/terraform-mirrors/${configId}`,
    data,
  )
  return response.data
}

export async function deleteTerraformMirrorConfig(configId: string): Promise<void> {
  await http.delete(`/api/v1/admin/terraform-mirrors/${configId}`)
}

export async function triggerTerraformMirrorSync(configId: string): Promise<{ message: string }> {
  const response = await http.post<{ message: string }>(
    `/api/v1/admin/terraform-mirrors/${configId}/sync`,
    {},
  )
  return response.data
}

export async function listTerraformVersions(
  configId: string,
  options?: { synced?: boolean },
): Promise<TerraformVersionListResponse> {
  const params: Record<string, string> = {}
  if (options?.synced !== undefined) params.synced = String(options.synced)
  const response = await http.get<TerraformVersionListResponse>(
    `/api/v1/admin/terraform-mirrors/${configId}/versions`,
    {
      params,
    },
  )
  return response.data
}

export async function getTerraformVersion(
  configId: string,
  version: string,
): Promise<TerraformVersion> {
  const response = await http.get<TerraformVersion>(
    `/api/v1/admin/terraform-mirrors/${configId}/versions/${version}`,
  )
  return response.data
}

export async function deleteTerraformVersion(configId: string, version: string): Promise<void> {
  await http.delete(`/api/v1/admin/terraform-mirrors/${configId}/versions/${version}`)
}

export async function deprecateTerraformVersion(configId: string, version: string): Promise<void> {
  await http.post(`/api/v1/admin/terraform-mirrors/${configId}/versions/${version}/deprecate`, {})
}

export async function undeprecateTerraformVersion(
  configId: string,
  version: string,
): Promise<void> {
  await http.delete(`/api/v1/admin/terraform-mirrors/${configId}/versions/${version}/deprecate`)
}

export async function listTerraformVersionPlatforms(
  configId: string,
  version: string,
): Promise<TerraformVersionPlatform[]> {
  const response = await http.get<
    TerraformVersionPlatform[] | { platforms?: TerraformVersionPlatform[] }
  >(`/api/v1/admin/terraform-mirrors/${configId}/versions/${version}/platforms`)
  return Array.isArray(response.data) ? response.data : (response.data.platforms ?? [])
}

export async function getTerraformMirrorHistory(
  configId: string,
  limit = 20,
): Promise<TerraformSyncHistoryListResponse> {
  const response = await http.get<TerraformSyncHistoryListResponse>(
    `/api/v1/admin/terraform-mirrors/${configId}/history`,
    {
      params: { limit },
    },
  )
  return response.data
}

export async function getReleasesGPGKeys(): Promise<ReleasesGPGKeysResponse> {
  const response = await http.get<ReleasesGPGKeysResponse>(
    '/api/v1/admin/terraform-mirrors/releases-gpg-keys',
  )
  return response.data
}

// ============================================================================
// Terraform Binary Mirror — Public Endpoints (no auth required)
// The :name segment identifies the mirror config by its human-readable name.
// ============================================================================

export async function listPublicTerraformVersions(
  name: string,
): Promise<TerraformVersionListResponse> {
  const response = await http.get<TerraformVersionListResponse>(
    `/terraform/binaries/${name}/versions`,
  )
  return response.data
}

export async function getPublicLatestTerraformVersion(name: string): Promise<TerraformVersion> {
  const response = await http.get<TerraformVersion>(`/terraform/binaries/${name}/versions/latest`)
  return response.data
}

export async function getPublicTerraformVersion(
  name: string,
  version: string,
): Promise<TerraformVersion> {
  const response = await http.get<TerraformVersion>(
    `/terraform/binaries/${name}/versions/${version}`,
  )
  return response.data
}

export async function getTerraformBinaryDownload(
  name: string,
  version: string,
  os: string,
  arch: string,
): Promise<TerraformBinaryDownloadResponse> {
  const response = await http.get<TerraformBinaryDownloadResponse>(
    `/terraform/binaries/${name}/versions/${version}/${os}/${arch}`,
  )
  return response.data
}
