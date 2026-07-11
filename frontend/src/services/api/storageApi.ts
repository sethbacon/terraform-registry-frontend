import { http } from './http'
import type {
  MigrationPlan,
  StorageConfigInput,
  StorageConfigResponse,
  StorageMigration,
} from '../../types'

// ============================================================================
// Storage Configuration
// ============================================================================

export async function getActiveStorageConfig(): Promise<StorageConfigResponse> {
  const response = await http.get('/api/v1/storage/config')
  return response.data
}

export async function listStorageConfigs(): Promise<StorageConfigResponse[]> {
  const response = await http.get('/api/v1/storage/configs')
  return response.data
}

export async function getStorageConfig(id: string): Promise<StorageConfigResponse> {
  const response = await http.get(`/api/v1/storage/configs/${id}`)
  return response.data
}

export async function createStorageConfig(
  data: StorageConfigInput,
): Promise<StorageConfigResponse> {
  const response = await http.post('/api/v1/storage/configs', data)
  return response.data
}

export async function updateStorageConfig(
  id: string,
  data: StorageConfigInput,
): Promise<StorageConfigResponse> {
  const response = await http.put(`/api/v1/storage/configs/${id}`, data)
  return response.data
}

export async function deleteStorageConfig(id: string): Promise<void> {
  await http.delete(`/api/v1/storage/configs/${id}`)
}

export async function activateStorageConfig(
  id: string,
): Promise<{ message: string; config: StorageConfigResponse }> {
  const response = await http.post(`/api/v1/storage/configs/${id}/activate`)
  return response.data
}

export async function testStorageConfig(
  data: StorageConfigInput,
): Promise<{ success: boolean; message: string }> {
  const response = await http.post('/api/v1/storage/configs/test', data)
  return response.data
}

// ============================================================================
// Storage Migrations
// ============================================================================

export async function planStorageMigration(
  sourceId: string,
  targetId: string,
): Promise<MigrationPlan> {
  const response = await http.post('/api/v1/admin/storage/migrations/plan', {
    source_config_id: sourceId,
    target_config_id: targetId,
  })
  return response.data
}

export async function startStorageMigration(
  sourceId: string,
  targetId: string,
): Promise<StorageMigration> {
  const response = await http.post('/api/v1/admin/storage/migrations', {
    source_config_id: sourceId,
    target_config_id: targetId,
  })
  return response.data
}

export async function getStorageMigration(id: string): Promise<StorageMigration> {
  const response = await http.get(`/api/v1/admin/storage/migrations/${id}`)
  return response.data
}

export async function cancelStorageMigration(id: string): Promise<StorageMigration> {
  const response = await http.post(`/api/v1/admin/storage/migrations/${id}/cancel`)
  return response.data
}

export async function listStorageMigrations(): Promise<StorageMigration[]> {
  const response = await http.get('/api/v1/admin/storage/migrations')
  return response.data
}
