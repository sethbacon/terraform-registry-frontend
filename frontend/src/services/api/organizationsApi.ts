/**
 * Organizations domain API — organization CRUD, search, and member management.
 */
import { http } from './http'
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
    `/api/v1/organizations/${id}`,
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
  // Check if the response contains an error
  if (response.status !== 200 && response.status !== 201) {
    throw new Error(response.data?.error || 'Failed to create organization')
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
    `/api/v1/organizations/${id}`,
    data,
  )
  return transformOrganization(response.data.organization)
}

export async function deleteOrganization(id: string): Promise<{ message: string }> {
  const response = await http.delete<{ message: string }>(`/api/v1/organizations/${id}`)
  return response.data
}

export async function addOrganizationMember(
  orgId: string,
  data: { user_id: string; role_template_id?: string },
) {
  const response = await http.post(`/api/v1/organizations/${orgId}/members`, data)
  return response.data
}

export async function updateOrganizationMember(
  orgId: string,
  userId: string,
  data: { role_template_id?: string },
) {
  const response = await http.put(`/api/v1/organizations/${orgId}/members/${userId}`, data)
  return response.data
}

export async function removeOrganizationMember(
  orgId: string,
  userId: string,
): Promise<{ message: string }> {
  const response = await http.delete<{ message: string }>(
    `/api/v1/organizations/${orgId}/members/${userId}`,
  )
  return response.data
}

export async function listOrganizationMembers(
  orgId: string,
): Promise<OrganizationMemberWithUser[]> {
  const response = await http.get<{ members?: OrganizationMemberWithUser[] }>(
    `/api/v1/organizations/${orgId}/members`,
  )
  return response.data.members || []
}
