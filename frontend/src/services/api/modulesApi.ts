import { http } from './http'
import type { Module, ModuleVersion, ModuleDoc } from '../../types'

/**
 * A Terraform State Manager state that references this module, surfaced via the
 * suite consumers proxy. `module_version` is null when the state only carries a
 * version constraint (no locked version) — rendered as "constraint only".
 */
export interface ModuleConsumer {
  source_id: string
  source_name: string
  state_key: string
  module_version: string | null
  observed_at: string
}

/**
 * Response shape of GET /api/v1/modules/search. `meta` uses limit/offset
 * pagination (not page/per_page).
 */
export interface ModuleSearchResponse {
  modules: Module[]
  meta: { total: number; limit: number; offset: number }
}

/**
 * Terraform Module Registry Protocol response for
 * GET /v1/modules/{namespace}/{name}/{system}/versions.
 */
export interface ModuleVersionsResponse {
  modules: { source: string | null; versions: ModuleVersion[] }[]
  total: number
  limit: number
  offset: number
}

// Modules
export async function searchModules(options?: {
  query?: string
  limit?: number
  offset?: number
  page?: number
  per_page?: number
  sort?: string
  order?: string
}): Promise<ModuleSearchResponse> {
  const params: Record<string, string | number> = {}

  if (options?.query) params.q = options.query
  if (options?.limit) params.limit = options.limit
  if (options?.offset !== undefined) params.offset = options.offset
  if (options?.page) params.page = options.page
  if (options?.per_page) params.per_page = options.per_page
  if (options?.sort) params.sort = options.sort
  if (options?.order) params.order = options.order

  const response = await http.get<ModuleSearchResponse>('/api/v1/modules/search', { params })
  return response.data
}

export async function getModuleVersions(
  namespace: string,
  name: string,
  system: string,
): Promise<ModuleVersionsResponse> {
  const response = await http.get<ModuleVersionsResponse>(
    `/v1/modules/${namespace}/${name}/${system}/versions`,
  )
  return response.data
}

export async function createModuleRecord(data: {
  namespace: string
  name: string
  system: string
  description?: string
  organization_id?: string
}): Promise<{ id: string; namespace: string; name: string; system: string }> {
  const response = await http.post('/api/v1/admin/modules/create', data)
  return response.data
}

export async function uploadModule(
  formData: FormData,
  options?: { onUploadProgress?: (percent: number) => void },
) {
  const response = await http.post('/api/v1/modules', formData, {
    // Large archives on a slow connection can legitimately exceed the default
    // request timeout; onUploadProgress gives the user feedback instead.
    timeout: 0,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: options?.onUploadProgress
      ? (event) => {
        if (event.total && event.total > 0) {
          const percent = Math.round((event.loaded / event.total) * 100)
          options.onUploadProgress?.(percent)
        }
      }
      : undefined,
  })
  return response.data
}

export async function getModule(namespace: string, name: string, system: string): Promise<Module> {
  const response = await http.get<Module>(`/api/v1/modules/${namespace}/${name}/${system}`)
  return response.data
}

export async function deleteModule(
  namespace: string,
  name: string,
  system: string,
): Promise<{ message: string }> {
  const response = await http.delete<{ message: string }>(
    `/api/v1/modules/${namespace}/${name}/${system}`,
  )
  return response.data
}

export async function deleteModuleVersion(
  namespace: string,
  name: string,
  system: string,
  version: string,
): Promise<{ message: string }> {
  const response = await http.delete<{ message: string }>(
    `/api/v1/modules/${namespace}/${name}/${system}/versions/${version}`,
  )
  return response.data
}

export async function reanalyzeModuleVersion(
  namespace: string,
  name: string,
  system: string,
  version: string,
): Promise<{ message: string; docs?: string; scan?: string }> {
  const response = await http.post<{ message: string; docs?: string; scan?: string }>(
    `/api/v1/modules/${namespace}/${name}/${system}/versions/${version}/reanalyze`,
  )
  return response.data
}

export async function deprecateModuleVersion(
  namespace: string,
  name: string,
  system: string,
  version: string,
  message?: string,
  replacementSource?: string,
): Promise<{ message: string }> {
  const body: Record<string, string> = {}
  if (message) body.message = message
  if (replacementSource) body.replacement_source = replacementSource
  const response = await http.post<{ message: string }>(
    `/api/v1/modules/${namespace}/${name}/${system}/versions/${version}/deprecate`,
    body,
  )
  return response.data
}

export async function undeprecateModuleVersion(
  namespace: string,
  name: string,
  system: string,
  version: string,
): Promise<{ message: string }> {
  const response = await http.delete<{ message: string }>(
    `/api/v1/modules/${namespace}/${name}/${system}/versions/${version}/deprecate`,
  )
  return response.data
}

export async function deprecateModule(
  namespace: string,
  name: string,
  system: string,
  data: { message: string; successor_module_id?: string },
): Promise<{ message: string }> {
  const response = await http.post<{ message: string }>(
    `/api/v1/modules/${namespace}/${name}/${system}/deprecate`,
    data,
  )
  return response.data
}

export async function undeprecateModule(
  namespace: string,
  name: string,
  system: string,
): Promise<{ message: string }> {
  const response = await http.delete<{ message: string }>(
    `/api/v1/modules/${namespace}/${name}/${system}/deprecate`,
  )
  return response.data
}

export async function getModuleConsumers(
  namespace: string,
  name: string,
  system: string,
): Promise<ModuleConsumer[]> {
  // Suite proxy: forwarded to the sibling State Manager when a shared service
  // token is configured, else returns an empty list. Backend wraps the list
  // as { consumers: [...] }; callers expect a bare array.
  const response = await http.get<{ consumers?: ModuleConsumer[] }>(
    `/api/v1/suite/modules/${namespace}/${name}/${system}/consumers`,
  )
  return response.data?.consumers ?? []
}

export async function updateModule(
  id: string,
  data: { description?: string; source?: string; namespace?: string },
): Promise<Module> {
  const response = await http.put<Module>(`/api/v1/admin/modules/${id}`, data)
  return response.data
}

export async function getModuleDocs(
  namespace: string,
  name: string,
  system: string,
  version: string,
): Promise<ModuleDoc> {
  const response = await http.get<ModuleDoc>(
    `/api/v1/modules/${namespace}/${name}/${system}/versions/${version}/docs`,
  )
  return response.data
}
