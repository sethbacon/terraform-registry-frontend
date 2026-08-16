/**
 * Organizations domain API — organization CRUD, search, and member management.
 */
import { http, encodeSegment } from './http'
import { sanitizeServerErrorMessage } from '../../utils/errors'
import type { Organization, OrganizationMemberWithUser } from '../../types'

/**
 * The largest `per_page` the organization list/search endpoints serve.
 *
 * Since backend #893 an over-large `per_page` clamps to this maximum; it used
 * to be RESET to the default of 20, so asking for 200 returned fewer rows than
 * asking for 50. Defined here, beside the requests it bounds, so the pages that
 * want "as many as possible" name one number rather than each picking their own.
 */
export const ORGANIZATION_PAGE_MAX = 100

/**
 * The page window the admin list endpoints return alongside their rows
 * (swagger: admin.PaginationMeta), added by backend #893.
 */
export interface PaginationMeta {
  page: number
  per_page: number
  /**
   * Whether any rows follow this page. **False if and only if this is the end
   * of the list**, on every endpoint emitting this shape — including the search
   * axes, which cannot count and derive it by fetching one row past the page.
   *
   * This is the field to read. Do NOT re-derive completeness from the row
   * count: "the page came back full" is wrong for every list whose length is an
   * exact multiple of the page size, which reports a phantom extra page.
   */
  has_more: boolean
  /**
   * Total matching rows across all pages, or **null when the endpoint does not
   * count** — the search axes have no counting query and send null.
   *
   * Deliberately nullable rather than absent: `null` ("not counted") and `0`
   * ("none matched") are different answers and must not be collapsed.
   */
  total: number | null
}

/** Wire shape of the list/search organizations endpoints (swagger: admin.ListOrganizationsResponse). */
interface ListOrganizationsResponse {
  organizations?: Record<string, unknown>[]
  pagination?: PaginationMeta
}

/** One page of organizations, plus whether anything follows it. */
export interface OrganizationPage {
  organizations: Organization[]
  /**
   * Whether more organizations exist beyond this page.
   *
   * The server's `has_more` and nothing else. There is deliberately no row-count
   * fallback: counting rows cannot distinguish "the last page happened to be
   * full" from "another page follows", which is wrong for every list whose
   * length is a multiple of the page size — the guess this field exists to
   * replace (backend #893).
   *
   * A backend predating #893 always sent a `pagination` object too; it simply
   * had no `has_more` inside it. So guarding on the object's presence would
   * silently yield `undefined` there rather than falling back, and the type
   * would not catch it. Absent or non-boolean therefore reads as false: unknown
   * is reported as "nothing follows", never as a guess dressed up as an answer.
   */
  hasMore: boolean
  /** Total across all pages, or null when this endpoint does not count. */
  total: number | null
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

function toPage(data: ListOrganizationsResponse): OrganizationPage {
  const organizations = (data.organizations || []).map((org: Record<string, unknown>) =>
    transformOrganization(org),
  )
  const pagination = data.pagination
  return {
    organizations,
    hasMore: pagination?.has_more === true,
    total: pagination ? (pagination.total ?? null) : null,
  }
}

// Organizations
/**
 * One page of organizations.
 *
 * Returns the page window as well as the rows: discarding it is what let the
 * organization pickers render a truncated list with nothing to say it was
 * truncated (backend #893). There is deliberately ONE function per endpoint
 * rather than a bare-array convenience beside a paged one — two accessors for
 * one question is how the caller that forgets to ask about completeness gets
 * written.
 */
export async function listOrganizations(page = 1, perPage = 20): Promise<OrganizationPage> {
  const response = await http.get<ListOrganizationsResponse>('/api/v1/organizations', {
    params: { page, per_page: perPage },
  })
  return toPage(response.data)
}

export async function searchOrganizations(
  query: string,
  page = 1,
  perPage = 20,
): Promise<OrganizationPage> {
  const response = await http.get<ListOrganizationsResponse>('/api/v1/organizations/search', {
    params: { q: query, page, per_page: perPage },
  })
  // This axis has no counting query, so `total` is null and `has_more` comes
  // from the server probing one row past the page.
  return toPage(response.data)
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
