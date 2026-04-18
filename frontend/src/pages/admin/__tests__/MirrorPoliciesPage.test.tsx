import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

const listMirrorPoliciesMock = vi.fn()
const createMirrorPolicyMock = vi.fn()
const updateMirrorPolicyMock = vi.fn()
const deleteMirrorPolicyMock = vi.fn()
const evaluateMirrorPolicyMock = vi.fn()

vi.mock('../../../services/api', () => ({
  default: {
    listMirrorPolicies: (...args: unknown[]) => listMirrorPoliciesMock(...args),
    createMirrorPolicy: (...args: unknown[]) => createMirrorPolicyMock(...args),
    updateMirrorPolicy: (...args: unknown[]) => updateMirrorPolicyMock(...args),
    deleteMirrorPolicy: (...args: unknown[]) => deleteMirrorPolicyMock(...args),
    evaluateMirrorPolicy: (...args: unknown[]) => evaluateMirrorPolicyMock(...args),
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

  it('opens create dialog when Create Policy is clicked', async () => {
    listMirrorPoliciesMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText('Create Policy')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /create policy/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByText('Create Mirror Policy')).toBeInTheDocument()
  })

  it('creates a new policy via the dialog', async () => {
    listMirrorPoliciesMock.mockResolvedValue([])
    createMirrorPolicyMock.mockResolvedValue({ id: 'new' })
    renderPage()
    await waitFor(() => expect(screen.getByText('Create Policy')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /create policy/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const nameInput = screen.getByRole('textbox', { name: /^name$/i })
    await userEvent.type(nameInput, 'my-policy')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))
    await waitFor(() => expect(createMirrorPolicyMock).toHaveBeenCalled())
  })

  it('opens edit dialog when edit button is clicked', async () => {
    listMirrorPoliciesMock.mockResolvedValue(fakePolicies)
    renderPage()
    await waitFor(() => expect(screen.getByText('Allow HashiCorp')).toBeInTheDocument())
    const editBtns = screen.getAllByRole('button', { name: /edit policy/i })
    await userEvent.click(editBtns[0])
    await waitFor(() => expect(screen.getByText('Edit Policy')).toBeInTheDocument())
  })

  it('updates a policy via the edit dialog', async () => {
    listMirrorPoliciesMock.mockResolvedValue(fakePolicies)
    updateMirrorPolicyMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('Allow HashiCorp')).toBeInTheDocument())
    const editBtns = screen.getAllByRole('button', { name: /edit policy/i })
    await userEvent.click(editBtns[0])
    await waitFor(() => expect(screen.getByText('Edit Policy')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^update$/i }))
    await waitFor(() => expect(updateMirrorPolicyMock).toHaveBeenCalledWith('pol-1', expect.any(Object)))
  })

  it('opens delete confirmation dialog', async () => {
    listMirrorPoliciesMock.mockResolvedValue(fakePolicies)
    renderPage()
    await waitFor(() => expect(screen.getByText('Allow HashiCorp')).toBeInTheDocument())
    const deleteBtns = screen.getAllByRole('button', { name: /delete policy/i })
    await userEvent.click(deleteBtns[0])
    await waitFor(() => expect(screen.getByText('Confirm Delete')).toBeInTheDocument())
  })

  it('deletes a policy after confirmation', async () => {
    listMirrorPoliciesMock.mockResolvedValue(fakePolicies)
    deleteMirrorPolicyMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('Allow HashiCorp')).toBeInTheDocument())
    const deleteBtns = screen.getAllByRole('button', { name: /delete policy/i })
    await userEvent.click(deleteBtns[0])
    await waitFor(() => expect(screen.getByText('Confirm Delete')).toBeInTheDocument())
    const confirmBtns = screen.getAllByRole('button', { name: /^delete$/i })
    await userEvent.click(confirmBtns[confirmBtns.length - 1])
    await waitFor(() => expect(deleteMirrorPolicyMock).toHaveBeenCalledWith('pol-1'))
  })

  it('cancels create dialog', async () => {
    listMirrorPoliciesMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText('Create Policy')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /create policy/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('opens Evaluate dialog and evaluates a policy', async () => {
    listMirrorPoliciesMock.mockResolvedValue(fakePolicies)
    evaluateMirrorPolicyMock.mockResolvedValue({
      allowed: true,
      matched_policy: 'Allow HashiCorp',
      reason: 'namespace matched',
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Allow HashiCorp')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Evaluate'))
    await waitFor(() => expect(screen.getByText('Evaluate Policy')).toBeInTheDocument())
    await userEvent.type(screen.getByRole('textbox', { name: /registry/i }), 'registry.terraform.io')
    await userEvent.type(screen.getByRole('textbox', { name: /namespace/i }), 'hashicorp')
    await userEvent.type(screen.getByRole('textbox', { name: /provider/i }), 'aws')
    const evaluateBtns = screen.getAllByText('Evaluate')
    await userEvent.click(evaluateBtns[evaluateBtns.length - 1])
    await waitFor(() => expect(evaluateMirrorPolicyMock).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText(/Allowed/)).toBeInTheDocument())
  })

  it('shows Denied result when evaluate returns allowed:false', async () => {
    listMirrorPoliciesMock.mockResolvedValue(fakePolicies)
    evaluateMirrorPolicyMock.mockResolvedValue({
      allowed: false,
      matched_policy: 'Deny External',
      reason: 'blocked',
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Allow HashiCorp')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Evaluate'))
    await waitFor(() => expect(screen.getByText('Evaluate Policy')).toBeInTheDocument())
    await userEvent.type(screen.getByRole('textbox', { name: /registry/i }), 'registry.terraform.io')
    await userEvent.type(screen.getByRole('textbox', { name: /namespace/i }), 'external-ns')
    await userEvent.type(screen.getByRole('textbox', { name: /provider/i }), 'anything')
    const evaluateBtns = screen.getAllByText('Evaluate')
    await userEvent.click(evaluateBtns[evaluateBtns.length - 1])
    await waitFor(() => expect(screen.getByText(/Denied/)).toBeInTheDocument())
  })

  it('closes evaluate dialog via Close button', async () => {
    listMirrorPoliciesMock.mockResolvedValue(fakePolicies)
    renderPage()
    await waitFor(() => expect(screen.getByText('Allow HashiCorp')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Evaluate'))
    await waitFor(() => expect(screen.getByText('Evaluate Policy')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^close$/i }))
    await waitFor(() => expect(screen.queryByText('Evaluate Policy')).not.toBeInTheDocument())
  })

  it('clicking Refresh re-fetches policies', async () => {
    listMirrorPoliciesMock.mockResolvedValue(fakePolicies)
    renderPage()
    await waitFor(() => expect(screen.getByText('Allow HashiCorp')).toBeInTheDocument())
    listMirrorPoliciesMock.mockClear()
    await userEvent.click(screen.getByRole('button', { name: /refresh/i }))
    await waitFor(() => expect(listMirrorPoliciesMock).toHaveBeenCalled())
  })

  it('shows error when create mutation fails', async () => {
    listMirrorPoliciesMock.mockResolvedValue([])
    createMirrorPolicyMock.mockRejectedValue(new Error('create boom'))
    renderPage()
    await waitFor(() => expect(screen.getByText('Create Policy')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /create policy/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await userEvent.type(screen.getByRole('textbox', { name: /^name$/i }), 'x')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))
    await waitFor(() => expect(screen.getByText('create boom')).toBeInTheDocument())
  })

  it('shows "Requires approval" chip for policies that require approval', async () => {
    listMirrorPoliciesMock.mockResolvedValue(fakePolicies)
    renderPage()
    await waitFor(() => expect(screen.getByText('Deny External')).toBeInTheDocument())
    expect(screen.getByText('Requires approval')).toBeInTheDocument()
  })
})
