/**
 * Organizations domain API — organization CRUD, search, and member management.
 */
import { http, encodeSegment } from './http'
import { sanitizeServerErrorMessage } from '../../utils/errors'
import type { Organization, OrganizationMemberWithUser } from '../../types'

/** Wire shape of the list/search organizations endpoints (swagger: admin.ListOrganizationsResponse). */
interface ListOrganizationsResponse {
  organizations?: Record<string, unknown>[]
}

// Helper to transform organization from API format to frontend format
function transformOrganization(org: Record<string, unknown>): Organization {
  if (!org) {
    throw new Error('Cannot transform undefined organization')
  }
  return {
    id: org.id as string,
    name: org.name as string,
    display_name: org.display_name as string,
    // IdP binding — always present in the wire response (null when unbound).
    // Dropping these here made the binding invisible in the admin UI (#538).
    idp_type: (org.idp_type ?? null) as string | null,
    idp_name: (org.idp_name ?? null) as string | null,
    created_at: org.created_at as string,
    updated_at: org.updated_at as string,
  }
}

// Organizations
export async function listOrganizations(page = 1, perPage = 20): Promise<Organization[]> {
  const response = await http.get<ListOrganizationsResponse>('/api/v1/organizations', {
    params: { page, per_page: perPage },
  })
  const orgs = response.data.organizations || []
  return orgs.map((org: Record<string, unknown>) => transformOrganization(org))
}

export async function searchOrganizations(
  query: string,
  page = 1,
  perPage = 20,
): Promise<Organization[]> {
  const response = await http.get<ListOrganizationsResponse>('/api/v1/organizations/search', {
    params: { q: query, page, per_page: perPage },
  })
  const orgs = response.data.organizations || []
  return orgs.map((org: Record<string, unknown>) => transformOrganization(org))
}

export async function getOrganization(id: string): Promise<Organization> {
  const response = await http.get<{ organization: Record<string, unknown> }>(
    `/api/v1/organizations/${encodeSegment(id)}`,
  )
  return transformOrganization(response.data.organization)
}

export async function createOrganization(data: {
  name: string
  display_name: string
}): Promise<Organization> {
  const response = await http.post<{ organization?: Record<string, unknown>; error?: string }>(
    '/api/v1/organizations',
    data,
  )
  // Check if the response contains an error. This branch is reachable only for a
  // 2xx/3xx status other than 200/201 (4xx/5xx already reject via validateStatus).
  // Sanitize the backend string before wrapping it: a plain Error skips
  // getErrorMessage's AxiosError-scoped sanitization, so an unvetted message
  // (stack trace, SQL, file path) would otherwise reach callers' UI verbatim via
  // the generic Error branch (CWE-209, #601).
  if (response.status !== 200 && response.status !== 201) {
    const raw = response.data?.error
    const safe = raw ? sanitizeServerErrorMessage(raw) : null
    throw new Error(safe ?? 'Failed to create organization')
  }
  if (!response.data.organization) {
    throw new Error('Invalid response from server: missing organization data')
  }
  return transformOrganization(response.data.organization)
}

export async function updateOrganization(
  id: string,
  data: {
    name?: string
    display_name: string
    idp_type?: string | null
    idp_name?: string | null
  },
): Promise<Organization> {
  const response = await http.put<{ organization: Record<string, unknown> }>(
    `/api/v1/organizations/${encodeSegment(id)}`,
    data,
  )
  return transformOrganization(response.data.organization)
}

export async function deleteOrganization(id: string): Promise<{ message: string }> {
  const response = await http.delete<{ message: string }>(`/api/v1/organizations/${encodeSegment(id)}`)
  return response.data
}

export async function addOrganizationMember(
  orgId: string,
  data: { user_id: string; role_template_id?: string },
) {
  const response = await http.post(`/api/v1/organizations/${encodeSegment(orgId)}/members`, data)
  return response.data
}

export async function updateOrganizationMember(
  orgId: string,
  userId: string,
  data: { role_template_id?: string },
) {
  const response = await http.put(`/api/v1/organizations/${encodeSegment(orgId)}/members/${encodeSegment(userId)}`, data)
  return response.data
}

export async function removeOrganizationMember(
  orgId: string,
  userId: string,
): Promise<{ message: string }> {
  const response = await http.delete<{ message: string }>(
    `/api/v1/organizations/${encodeSegment(orgId)}/members/${encodeSegment(userId)}`,
  )
  return response.data
}

export async function listOrganizationMembers(
  orgId: string,
): Promise<OrganizationMemberWithUser[]> {
  const response = await http.get<{ members?: OrganizationMemberWithUser[] }>(
    `/api/v1/organizations/${encodeSegment(orgId)}/members`,
  )
  return response.data.members || []
}
