import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import api from '../../services/api'
import type { SCMProvider, SCMRepository, SCMTag } from '../../types/scm'

vi.mock('../../services/api')
vi.mock('../RepositoryBrowser', () => ({
  default: ({
    onRepositorySelect,
    onTagSelect,
  }: {
    onRepositorySelect: (repo: SCMRepository) => void
    onTagSelect: (repo: SCMRepository, tag: SCMTag) => void
  }) => (
    <div data-testid="repository-browser">
      <button
        data-testid="select-repo"
        onClick={() =>
          onRepositorySelect({
            id: 'repo-1',
            name: 'terraform-aws-vpc',
            full_name: 'org/terraform-aws-vpc',
            owner: 'org',
            description: '',
            default_branch: 'main',
            clone_url: '',
            html_url: '',
            private: false,
          })
        }
      >
        Select Repo
      </button>
      <button
        data-testid="select-tag"
        onClick={() =>
          onTagSelect(
            {
              id: 'repo-1',
              name: 'terraform-aws-vpc',
              full_name: 'org/terraform-aws-vpc',
              owner: 'org',
              description: '',
              default_branch: 'main',
              clone_url: '',
              html_url: '',
              private: false,
            },
            { tag_name: 'v1.0.0', target_commit: 'abc1234567890' },
          )
        }
      >
        Select Tag
      </button>
    </div>
  ),
}))

const mockProviders: SCMProvider[] = [
  {
    id: 'prov-1',
    organization_id: 'org-1',
    provider_type: 'github',
    name: 'GitHub',
    client_id: 'cid',
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  ;(api.listSCMProviders as Mock).mockResolvedValue(mockProviders)
  ;(api.linkModuleToSCM as Mock).mockResolvedValue({})
  ;(api.triggerManualSync as Mock).mockResolvedValue({})
})

function renderWizard(
  props: Partial<{
    moduleId: string
    moduleSystem: string
    onComplete: () => void
    onCancel: () => void
  }> = {},
) {
  return render(
    <PublishFromSCMWizard
      moduleId={props.moduleId ?? 'mod-1'}
      moduleSystem={props.moduleSystem}
      onComplete={props.onComplete}
      onCancel={props.onCancel}
    />,
  )
}

import PublishFromSCMWizard from '../PublishFromSCMWizard'

describe('PublishFromSCMWizard', () => {
  // ── Step 0: Select Provider ──────────────────────────────────

  it('renders stepper with three steps', async () => {
    renderWizard()
    await waitFor(() => expect(screen.getByText('Select SCM Provider')).toBeInTheDocument())
    expect(screen.getByText('Select Provider')).toBeInTheDocument()
    expect(screen.getByText('Choose Repository')).toBeInTheDocument()
    expect(screen.getByText('Configure Settings')).toBeInTheDocument()
  })

  it('loads providers on mount', async () => {
    renderWizard()
    await waitFor(() => expect(api.listSCMProviders).toHaveBeenCalledOnce())
  })

  it('shows warning when no providers found', async () => {
    ;(api.listSCMProviders as Mock).mockResolvedValue([])
    renderWizard()
    await waitFor(() =>
      expect(screen.getByText(/No active SCM providers found/)).toBeInTheDocument(),
    )
  })

  it('shows error when provider load fails', async () => {
    ;(api.listSCMProviders as Mock).mockRejectedValue(new Error('net'))
    renderWizard()
    await waitFor(() =>
      expect(screen.getByText('Failed to load SCM providers')).toBeInTheDocument(),
    )
  })

  it('disables Next button when no provider selected', async () => {
    renderWizard()
    await waitFor(() => expect(screen.getByText('Select SCM Provider')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  async function selectProvider(user: ReturnType<typeof userEvent.setup>) {
    const select = screen.getByRole('combobox')
    await user.click(select)
    await user.click(screen.getByText('GitHub (github)'))
  }

  it('enables Next after selecting a provider', async () => {
    const user = userEvent.setup()
    renderWizard()
    await waitFor(() => expect(screen.getByText('Select SCM Provider')).toBeInTheDocument())

    await selectProvider(user)

    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  // ── Step 1: Choose Repository ────────────────────────────────

  it('shows repository browser on step 1', async () => {
    const user = userEvent.setup()
    renderWizard()
    await waitFor(() => expect(screen.getByText('Select SCM Provider')).toBeInTheDocument())

    await selectProvider(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByTestId('repository-browser')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Choose Repository' })).toBeInTheDocument()
  })

  it('disables Next on step 1 until repo selected', async () => {
    const user = userEvent.setup()
    renderWizard()
    await waitFor(() => expect(screen.getByText('Select SCM Provider')).toBeInTheDocument())

    await selectProvider(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()

    await user.click(screen.getByTestId('select-repo'))
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  // ── Step 2: Configure Settings ───────────────────────────────

  async function goToStep3(user: ReturnType<typeof userEvent.setup>, selectTag = false) {
    renderWizard()
    await waitFor(() => expect(screen.getByText('Select SCM Provider')).toBeInTheDocument())
    await selectProvider(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))

    if (selectTag) {
      await user.click(screen.getByTestId('select-tag'))
    } else {
      await user.click(screen.getByTestId('select-repo'))
    }
    await user.click(screen.getByRole('button', { name: 'Next' }))
  }

  it('shows sync_all settings by default when no tag selected', async () => {
    const user = userEvent.setup()
    await goToStep3(user)

    expect(screen.getByRole('heading', { name: 'Configure Settings' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Tag Pattern/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Default Branch/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Enable automatic publishing/)).toBeInTheDocument()
  })

  it('defaults to specific_tag mode when tag was selected', async () => {
    const user = userEvent.setup()
    await goToStep3(user, true)

    expect(screen.getByText(/v1\.0\.0/)).toBeInTheDocument()
  })

  it('shows selected repository summary on step 3', async () => {
    const user = userEvent.setup()
    await goToStep3(user)
    expect(screen.getByText('org/terraform-aws-vpc')).toBeInTheDocument()
  })

  // ── Navigation ───────────────────────────────────────────────

  it('Back button goes to previous step', async () => {
    const user = userEvent.setup()
    renderWizard()
    await waitFor(() => expect(screen.getByText('Select SCM Provider')).toBeInTheDocument())

    await selectProvider(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('heading', { name: 'Choose Repository' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'Select SCM Provider' })).toBeInTheDocument()
  })

  it('Cancel button calls onCancel', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<PublishFromSCMWizard moduleId="mod-1" onCancel={onCancel} />)
    await waitFor(() => expect(screen.getByText('Select SCM Provider')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  // ── Completion (Link Module) ─────────────────────────────────

  it('calls linkModuleToSCM with sync_all settings', async () => {
    const onComplete = vi.fn()
    const user = userEvent.setup()
    render(<PublishFromSCMWizard moduleId="mod-1" onComplete={onComplete} />)
    await waitFor(() => expect(screen.getByText('Select SCM Provider')).toBeInTheDocument())

    // Step 0 → 1
    await selectProvider(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))

    // Step 1 → 2
    await user.click(screen.getByTestId('select-repo'))
    await user.click(screen.getByRole('button', { name: 'Next' }))

    // Step 2: Link
    await user.click(screen.getByRole('button', { name: 'Link Module' }))

    await waitFor(() => expect(api.linkModuleToSCM).toHaveBeenCalledOnce())
    expect(api.linkModuleToSCM).toHaveBeenCalledWith(
      'mod-1',
      expect.objectContaining({
        provider_id: 'prov-1',
        repository_owner: 'org',
        repository_name: 'terraform-aws-vpc',
        default_branch: 'main',
        auto_publish_enabled: true,
        tag_pattern: 'v*',
      }),
    )
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('calls linkModuleToSCM + triggerManualSync for specific_tag', async () => {
    const onComplete = vi.fn()
    const user = userEvent.setup()
    render(<PublishFromSCMWizard moduleId="mod-1" onComplete={onComplete} />)
    await waitFor(() => expect(screen.getByText('Select SCM Provider')).toBeInTheDocument())

    await selectProvider(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))

    // Select tag (sets both repo and tag)
    await user.click(screen.getByTestId('select-tag'))
    await user.click(screen.getByRole('button', { name: 'Next' }))

    await user.click(screen.getByRole('button', { name: 'Link Module' }))

    await waitFor(() => expect(api.linkModuleToSCM).toHaveBeenCalledOnce())
    expect(api.linkModuleToSCM).toHaveBeenCalledWith(
      'mod-1',
      expect.objectContaining({
        auto_publish_enabled: false,
        tag_pattern: 'v1.0.0',
      }),
    )
    expect(api.triggerManualSync).toHaveBeenCalledWith('mod-1')
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('shows error when linkModuleToSCM fails', async () => {
    ;(api.linkModuleToSCM as Mock).mockRejectedValue(new Error('Link failed'))
    const user = userEvent.setup()
    render(<PublishFromSCMWizard moduleId="mod-1" />)
    await waitFor(() => expect(screen.getByText('Select SCM Provider')).toBeInTheDocument())

    await selectProvider(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByTestId('select-repo'))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Link Module' }))

    await waitFor(() => expect(screen.getByText('Link failed')).toBeInTheDocument())
  })
})
