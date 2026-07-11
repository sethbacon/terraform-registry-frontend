/**
 * Users domain API — user CRUD, search, GDPR export/erasure, and membership lookups.
 */
import { http } from './http'
import type { PaginationMeta, User, UserMembership } from '../../types'

/**
 * Shape produced by transformUser: `User` plus the flattened role-template
 * fields the backend includes on some user payloads.
 */
type TransformedUser = User & {
  role_template_id?: string
  role_template_name?: string
  role_template_display_name?: string
}

/** Wire shape of the list/search users endpoints (swagger: admin.ListUsersResponse). */
interface ListUsersResponse {
  users?: Record<string, unknown>[]
  pagination: PaginationMeta
}

// Helper to transform user from API format to frontend format
function transformUser(user: Record<string, unknown>): TransformedUser {
  return {
    id: (user.ID || user.id) as string,
    email: (user.Email || user.email) as string,
    name: (user.Name || user.name) as string,
    oidc_sub: (user.OidcSub || user.oidc_sub) as string | undefined,
    role_template_id: (user.RoleTemplateID || user.role_template_id) as string | undefined,
    role_template_name: (user.RoleTemplateName || user.role_template_name) as string | undefined,
    role_template_display_name: (user.RoleTemplateDisplayName ||
      user.role_template_display_name) as string | undefined,
    created_at: (user.CreatedAt || user.created_at) as string,
    updated_at: (user.UpdatedAt || user.updated_at) as string,
    memberships: (user.memberships || user.Memberships) as UserMembership[] | undefined,
  }
}

// Users
export async function listUsers(
  page = 1,
  perPage = 20,
): Promise<{ users: User[]; pagination: PaginationMeta }> {
  const response = await http.get<ListUsersResponse>('/api/v1/users', {
    params: { page, per_page: perPage },
  })
  const users = response.data.users || []
  return {
    users: users.map((user: Record<string, unknown>) => transformUser(user)),
    pagination: response.data.pagination,
  }
}

export async function searchUsers(
  query: string,
  page = 1,
  perPage = 20,
): Promise<{ users: User[]; pagination: PaginationMeta }> {
  const response = await http.get<ListUsersResponse>('/api/v1/users/search', {
    params: { q: query, page, per_page: perPage },
  })
  const users = response.data.users || []
  return {
    users: users.map((user: Record<string, unknown>) => transformUser(user)),
    pagination: response.data.pagination,
  }
}

export async function getUser(id: string) {
  const response = await http.get<{ user: Record<string, unknown> }>(`/api/v1/users/${id}`)
  return transformUser(response.data.user)
}

export async function createUser(data: { email: string; name: string }) {
  const response = await http.post<{ user: Record<string, unknown> }>('/api/v1/users', data)
  return transformUser(response.data.user)
}

export async function updateUser(id: string, data: { name?: string; email?: string }) {
  const response = await http.put<{ user: Record<string, unknown> }>(`/api/v1/users/${id}`, data)
  return transformUser(response.data.user)
}

export async function deleteUser(id: string): Promise<{ message: string }> {
  const response = await http.delete<{ message: string }>(`/api/v1/users/${id}`)
  return response.data
}

// GDPR Article 15/20 — full data export.
// Returns the response Blob directly so the caller can let the browser
// download it via Content-Disposition. Do not parse as JSON: the backend
// sets `Content-Disposition: attachment; filename=user-data-{id}.json`
// and we want that filename hint to flow to the browser.
export async function exportUserData(id: string): Promise<{ blob: Blob; filename: string }> {
  const response = await http.get(`/api/v1/admin/users/${id}/export`, {
    responseType: 'blob',
  })
  // Default to user-data-{id}.json; override if the server provided a Content-Disposition.
  let filename = `user-data-${id}.json`
  const disposition = response.headers['content-disposition']
  if (disposition) {
    const match = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition)
    if (match && match[1]) {
      filename = match[1].trim()
    }
  }
  return { blob: response.data as Blob, filename }
}

// GDPR Article 17 — anonymize user PII while preserving audit trail.
export async function eraseUser(id: string): Promise<{ message: string; user_id: string }> {
  const response = await http.post(`/api/v1/admin/users/${id}/erase`)
  return response.data as { message: string; user_id: string }
}

export async function getUserMemberships(userId: string): Promise<UserMembership[]> {
  const response = await http.get<{ memberships?: UserMembership[] }>(
    `/api/v1/users/${userId}/memberships`,
  )
  return response.data.memberships || []
}

// Self-access endpoint for current user's memberships (no special scope required)
export async function getCurrentUserMemberships(): Promise<UserMembership[]> {
  const response = await http.get<{ memberships?: UserMembership[] }>(
    '/api/v1/users/me/memberships',
  )
  return response.data.memberships || []
}
