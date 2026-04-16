import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

const listMirrorPoliciesMock = vi.fn()
vi.mock('../../../services/api', () => ({
  default: {
    listMirrorPolicies: (...args: unknown[]) => listMirrorPoliciesMock(...args),
  },
}))

import MirrorPoliciesPage from '../MirrorPoliciesPage'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
}

function renderPage() {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MirrorPoliciesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const fakePolicies = [
  {
    id: 'pol-1',
    name: 'Allow HashiCorp',
    description: 'Allow all HashiCorp providers',
    policy_type: 'allow' as const,
    upstream_registry: 'registry.terraform.io',
    namespace_pattern: 'hashicorp',
    provider_pattern: '*',
    priority: 10,
    is_active: true,
    requires_approval: false,
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2025-06-01T00:00:00Z',
  },
  {
    id: 'pol-2',
    name: 'Deny External',
    description: 'Block external providers',
    policy_type: 'deny' as const,
    upstream_registry: 'registry.terraform.io',
    namespace_pattern: 'external-*',
    provider_pattern: '*',
    priority: 5,
    is_active: false,
    requires_approval: true,
    created_at: '2025-06-02T00:00:00Z',
    updated_at: '2025-06-02T00:00:00Z',
  },
]

describe('MirrorPoliciesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner initially', () => {
    listMirrorPoliciesMock.mockReturnValue(new Promise(() => { }))
    renderPage()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders heading and description after load', async () => {
    listMirrorPoliciesMock.mockResolvedValue(fakePolicies)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Mirror Policies')).toBeInTheDocument()
    })
    expect(
      screen.getByText('Define allow/deny rules for provider mirroring'),
    ).toBeInTheDocument()
  })

  it('shows policy cards with policy data', async () => {
    listMirrorPoliciesMock.mockResolvedValue(fakePolicies)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Allow HashiCorp')).toBeInTheDocument()
    })
    expect(screen.getByText('Deny External')).toBeInTheDocument()
    expect(screen.getByText('Allow all HashiCorp providers')).toBeInTheDocument()
    expect(screen.getByText('Block external providers')).toBeInTheDocument()
    expect(screen.getByText('Namespace: hashicorp')).toBeInTheDocument()
    expect(screen.getByText('Namespace: external-*')).toBeInTheDocument()
    expect(screen.getAllByText('Provider: *')).toHaveLength(2)
    expect(screen.getByText('Priority: 10')).toBeInTheDocument()
  })

  it('shows status chips for Allow/Deny and Active/Inactive', async () => {
    listMirrorPoliciesMock.mockResolvedValue(fakePolicies)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Allow')).toBeInTheDocument()
    })
    expect(screen.getByText('Deny')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('shows empty state when no policies exist', async () => {
    listMirrorPoliciesMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => {
      expect(
        screen.getByText(
          'No mirror policies found. Create one to control which providers can be mirrored.',
        ),
      ).toBeInTheDocument()
    })
  })

  it('shows Create Policy button', async () => {
    listMirrorPoliciesMock.mockResolvedValue(fakePolicies)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Create Policy')).toBeInTheDocument()
    })
  })

  it('shows error state when API fails', async () => {
    listMirrorPoliciesMock.mockRejectedValue(new Error('Network error'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(screen.getByText('Network error')).toBeInTheDocument()
  })
})
