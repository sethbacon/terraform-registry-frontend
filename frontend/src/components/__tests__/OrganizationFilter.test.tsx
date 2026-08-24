import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const listOrganizationsMock = vi.fn()
const searchOrganizationsMock = vi.fn()

vi.mock('../../services/api', () => ({
  default: {
    listOrganizations: (...args: unknown[]) => listOrganizationsMock(...args),
    searchOrganizations: (...args: unknown[]) => searchOrganizationsMock(...args),
  },
}))

let mockAllowedScopes: string[] = []
let mockMemberships: Array<{ organization_id: string; organization_name: string }> = []

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ allowedScopes: mockAllowedScopes, memberships: mockMemberships }),
}))

import OrganizationFilter, { ORGANIZATION_PAGE_SIZE } from '../OrganizationFilter'

function renderFilter(props: { value?: string; onChange?: (id: string) => void } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const onChange = props.onChange ?? vi.fn()
  const utils = render(
    <QueryClientProvider client={qc}>
      <OrganizationFilter value={props.value ?? ''} onChange={onChange} />
    </QueryClientProvider>,
  )
  return { ...utils, onChange }
}

const membership = (id: string, name: string) => ({
  organization_id: id,
  organization_name: name,
})

const organization = (id: string, name: string) => ({
  id,
  name,
  display_name: `${name} display name`,
})

/** N distinct organizations, for exercising the page-size boundary. */
const organizations = (n: number) =>
  Array.from({ length: n }, (_, i) => organization(`org-${i}`, `slug-${i}`))

/**
 * One page as the API layer now returns it. `hasMore` is the SERVER's exact
 * answer, so the tests set it independently of the row count — which is the
 * whole point of backend #893, and what makes "a full page that is the last
 * page" expressible at all.
 */
const page = (
  orgs: ReturnType<typeof organization>[],
  hasMore = false,
  total: number | null = null,
) => ({
  organizations: orgs,
  hasMore,
  total,
})

describe('OrganizationFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAllowedScopes = []
    mockMemberships = []
    listOrganizationsMock.mockResolvedValue(page([]))
    searchOrganizationsMock.mockResolvedValue(page([]))
  })

  // ── Visibility ────────────────────────────────────────────────────────────

  it('is hidden when the caller belongs to no organization', () => {
    mockMemberships = []
    renderFilter()
    expect(screen.queryByTestId('organization-filter-input')).not.toBeInTheDocument()
  })

  // A one-item picker is a decoration: there is nothing to choose between, and
  // its absence restricts nothing because an unset filter already returns
  // everything the caller may see.
  it('is hidden when the caller belongs to exactly one organization', () => {
    mockMemberships = [membership('org-1', 'acme')]
    renderFilter()
    expect(screen.queryByTestId('organization-filter-input')).not.toBeInTheDocument()
  })

  it('is shown when the caller belongs to more than one organization', () => {
    mockMemberships = [membership('org-1', 'acme'), membership('org-2', 'globex')]
    renderFilter()
    expect(screen.getByTestId('organization-filter-input')).toBeInTheDocument()
  })

  // ── Where a platform admin's options come from ────────────────────────────

  // The load-bearing case. A platform admin's authority comes from the
  // platform_admins carrier rather than a membership, so they frequently have
  // ZERO memberships — by construction on a fresh deployment. Sourcing their
  // options from memberships would hide the picker from precisely the person
  // who can see every organization.
  it('is shown to a platform admin with no memberships at all', async () => {
    mockAllowedScopes = ['admin']
    mockMemberships = []
    listOrganizationsMock.mockResolvedValue(
      page([organization('org-1', 'acme'), organization('org-2', 'globex')]),
    )
    renderFilter()
    await waitFor(() => {
      expect(screen.getByTestId('organization-filter-input')).toBeInTheDocument()
    })
  })

  it('offers a platform admin every organization, not just their memberships', async () => {
    mockAllowedScopes = ['admin']
    mockMemberships = [membership('org-1', 'acme')]
    listOrganizationsMock.mockResolvedValue(
      page([
        organization('org-1', 'acme'),
        organization('org-2', 'globex'),
        organization('org-3', 'initech'),
      ]),
    )
    renderFilter()
    const input = await screen.findByTestId('organization-filter-input')
    await userEvent.click(input)
    expect(await screen.findByRole('option', { name: 'globex' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'initech' })).toBeInTheDocument()
  })

  it('does not fetch organizations for a caller who is not a platform admin', async () => {
    mockMemberships = [membership('org-1', 'acme'), membership('org-2', 'globex')]
    renderFilter()
    await screen.findByTestId('organization-filter-input')
    expect(listOrganizationsMock).not.toHaveBeenCalled()
  })

  it('is hidden from a platform admin when the deployment has only one organization', async () => {
    mockAllowedScopes = ['admin']
    listOrganizationsMock.mockResolvedValue(page([organization('org-1', 'acme')]))
    renderFilter()
    await waitFor(() => expect(listOrganizationsMock).toHaveBeenCalled())
    expect(screen.queryByTestId('organization-filter-input')).not.toBeInTheDocument()
  })

  // ── The truncation the picker must not inherit silently (backend #893) ────

  // `ListOrganizationsHandler` RESETS an out-of-range per_page to the default
  // of 20 rather than clamping it to the maximum, so asking for more than 100
  // returns fewer rows, not more. 100 is the largest page that does not shrink.
  it('asks for the largest page the backend actually honours', async () => {
    mockAllowedScopes = ['admin']
    listOrganizationsMock.mockResolvedValue(page(organizations(2)))
    renderFilter()
    await waitFor(() => expect(listOrganizationsMock).toHaveBeenCalledWith(1, 100))
    expect(ORGANIZATION_PAGE_SIZE).toBe(100)
    expect(ORGANIZATION_PAGE_SIZE).toBeLessThanOrEqual(100)
  })

  it('says so when the server reports more organizations beyond this page', async () => {
    mockAllowedScopes = ['admin']
    listOrganizationsMock.mockResolvedValue(page(organizations(ORGANIZATION_PAGE_SIZE), true, 137))
    renderFilter()
    expect(await screen.findByTestId('organization-filter-truncated')).toBeInTheDocument()
  })

  it('does not claim truncation when the whole list fits in one page', async () => {
    mockAllowedScopes = ['admin']
    listOrganizationsMock.mockResolvedValue(
      page(organizations(ORGANIZATION_PAGE_SIZE - 1), false, 99),
    )
    renderFilter()
    await screen.findByTestId('organization-filter-input')
    expect(screen.queryByTestId('organization-filter-truncated')).not.toBeInTheDocument()
  })

  // The case the old row-count heuristic got WRONG, and the reason this now
  // reads the server's flag: a page that is completely full and is nonetheless
  // the last one. Counting rows would tell the administrator to keep searching
  // for a 101st organization that does not exist.
  it('does not claim truncation on a full page that is the last page', async () => {
    mockAllowedScopes = ['admin']
    listOrganizationsMock.mockResolvedValue(
      page(organizations(ORGANIZATION_PAGE_SIZE), false, ORGANIZATION_PAGE_SIZE),
    )
    renderFilter()
    await screen.findByTestId('organization-filter-input')
    expect(screen.queryByTestId('organization-filter-truncated')).not.toBeInTheDocument()
  })

  // And the converse: a SHORT page the server says is not the end. The row
  // count would call this complete; only the flag knows better.
  it('says so on a short page the server reports as incomplete', async () => {
    mockAllowedScopes = ['admin']
    listOrganizationsMock.mockResolvedValue(page(organizations(3), true, null))
    renderFilter()
    expect(await screen.findByTestId('organization-filter-truncated')).toBeInTheDocument()
  })

  // What makes the truncation survivable: an organization outside the first
  // page is still reachable, because typing asks the server rather than
  // filtering the page already in hand.
  it('searches the server for a platform admin rather than filtering one page', async () => {
    mockAllowedScopes = ['admin']
    listOrganizationsMock.mockResolvedValue(page(organizations(ORGANIZATION_PAGE_SIZE), true, 137))
    searchOrganizationsMock.mockResolvedValue(page([organization('org-999', 'faraway')]))
    renderFilter()
    const input = await screen.findByTestId('organization-filter-input')
    await userEvent.type(input, 'faraway')
    await waitFor(() => expect(searchOrganizationsMock).toHaveBeenCalledWith('faraway', 1, 100))
    expect(await screen.findByRole('option', { name: 'faraway' })).toBeInTheDocument()
  })

  // ── Selection ─────────────────────────────────────────────────────────────

  // Unset must mean "everything the caller may see". A picker that arrives
  // pre-filled with a membership silently hides the rest of the estate from
  // someone who never chose to narrow it.
  it('starts unset rather than defaulting to a membership', () => {
    mockMemberships = [membership('org-1', 'acme'), membership('org-2', 'globex')]
    renderFilter()
    expect(screen.getByTestId('organization-filter-input')).toHaveValue('')
  })

  it('reports the chosen organization id', async () => {
    mockMemberships = [membership('org-1', 'acme'), membership('org-2', 'globex')]
    const { onChange } = renderFilter()
    await userEvent.click(screen.getByTestId('organization-filter-input'))
    await userEvent.click(await screen.findByRole('option', { name: 'globex' }))
    expect(onChange).toHaveBeenCalledWith('org-2')
  })

  // Clearing returns to "everything", which is the empty string — not the
  // previous organization, and not a null the callers would have to re-handle.
  it('reports an empty selection when cleared', async () => {
    mockMemberships = [membership('org-1', 'acme'), membership('org-2', 'globex')]
    const { onChange } = renderFilter({ value: 'org-2' })
    await userEvent.click(screen.getByLabelText(/clear/i))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('labels an organization by its slug', () => {
    mockMemberships = [membership('org-1', 'acme-corp'), membership('org-2', 'globex')]
    renderFilter({ value: 'org-1' })
    expect(screen.getByTestId('organization-filter-input')).toHaveValue('acme-corp')
  })

  // A colleague's link naming an organization outside the loaded page must
  // still render as itself. Showing the control blank while the page stays
  // filtered is the worst of both: narrowed data, no visible cause.
  it('renders a deep-linked organization that is not in the loaded page', async () => {
    mockAllowedScopes = ['admin']
    listOrganizationsMock.mockResolvedValue(page(organizations(3)))
    renderFilter({ value: 'org-outside-the-page' })
    await waitFor(() => {
      expect(screen.getByTestId('organization-filter-input')).toHaveValue('org-outside-the-page')
    })
  })
})
