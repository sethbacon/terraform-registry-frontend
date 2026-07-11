import { http } from './http'
import type {
  Provider,
  ProviderVersion,
  ProviderDocsResponse,
  ProviderDocContent,
} from '../../types'

/**
 * Response shape of GET /api/v1/providers/search. `meta` uses limit/offset
 * pagination (not page/per_page).
 */
export interface ProviderSearchResponse {
  providers: Provider[]
  meta: { total: number; limit: number; offset: number }
}

/**
 * Provider Registry Protocol response for
 * GET /v1/providers/{namespace}/{type}/versions.
 */
export interface ProviderVersionsResponse {
  versions: ProviderVersion[]
  total: number
  limit: number
  offset: number
}

// Providers
export async function searchProviders(options?: {
  query?: string
  limit?: number
  offset?: number
  page?: number
  per_page?: number
  sort?: string
  order?: string
}): Promise<ProviderSearchResponse> {
  const params: Record<string, string | number> = {}

  if (options?.query) params.q = options.query
  if (options?.limit) params.limit = options.limit
  if (options?.offset !== undefined) params.offset = options.offset
  if (options?.page) params.page = options.page
  if (options?.per_page) params.per_page = options.per_page
  if (options?.sort) params.sort = options.sort
  if (options?.order) params.order = options.order

  const response = await http.get<ProviderSearchResponse>('/api/v1/providers/search', { params })
  return response.data
}

export async function getProviderVersions(
  namespace: string,
  type: string,
): Promise<ProviderVersionsResponse> {
  const response = await http.get<ProviderVersionsResponse>(
    `/v1/providers/${namespace}/${type}/versions`,
  )
  return response.data
}

export async function uploadProvider(
  formData: FormData,
  options?: { onUploadProgress?: (percent: number) => void },
) {
  const response = await http.post('/api/v1/providers', formData, {
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

export async function getProvider(namespace: string, type: string) {
  const response = await http.get(`/api/v1/providers/${namespace}/${type}`)
  return response.data
}

export async function deleteProvider(
  namespace: string,
  type: string,
): Promise<{ message: string }> {
  const response = await http.delete<{ message: string }>(`/api/v1/providers/${namespace}/${type}`)
  return response.data
}

export async function deleteProviderVersion(
  namespace: string,
  type: string,
  version: string,
): Promise<{ message: string }> {
  const response = await http.delete<{ message: string }>(
    `/api/v1/providers/${namespace}/${type}/versions/${version}`,
  )
  return response.data
}

export async function deprecateProviderVersion(
  namespace: string,
  type: string,
  version: string,
  message?: string,
): Promise<{ message: string }> {
  const response = await http.post<{ message: string }>(
    `/api/v1/providers/${namespace}/${type}/versions/${version}/deprecate`,
    message ? { message } : {},
  )
  return response.data
}

export async function undeprecateProviderVersion(
  namespace: string,
  type: string,
  version: string,
): Promise<{ message: string }> {
  const response = await http.delete<{ message: string }>(
    `/api/v1/providers/${namespace}/${type}/versions/${version}/deprecate`,
  )
  return response.data
}

export async function getProviderDocs(
  namespace: string,
  type: string,
  version: string,
  category?: string,
  language?: string,
  limit?: number,
  offset?: number,
): Promise<ProviderDocsResponse> {
  const params: Record<string, string | number> = {}
  if (category) params.category = category
  if (language) params.language = language
  if (limit !== undefined) params.limit = limit
  if (offset !== undefined) params.offset = offset
  const response = await http.get<ProviderDocsResponse>(
    `/api/v1/providers/${namespace}/${type}/versions/${version}/docs`,
    { params },
  )
  return response.data
}

export async function getProviderDocContent(
  namespace: string,
  type: string,
  version: string,
  category: string,
  slug: string,
): Promise<ProviderDocContent> {
  const response = await http.get<ProviderDocContent>(
    `/api/v1/providers/${namespace}/${type}/versions/${version}/docs/${category}/${slug}`,
  )
  return response.data
}
