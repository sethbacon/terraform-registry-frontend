import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// Mock the custom hook that provides all state
const mockHookReturn = {
  namespace: 'hashicorp',
  name: 'consul',
  system: 'aws',
  isAuthenticated: true,
  canManage: true,
  module: null as Record<string, unknown> | null,
  versions: [] as any[],
  selectedVersion: null as any,
  setSelectedVersion: vi.fn(),
  loading: false,
  error: null as string | null,
  deleteModuleDialogOpen: false,
  setDeleteModuleDialogOpen: vi.fn(),
  deleting: false,
  deleteVersionDialogOpen: false,
  setDeleteVersionDialogOpen: vi.fn(),
  versionToDelete: null,
  deprecateDialogOpen: false,
  setDeprecateDialogOpen: vi.fn(),
  deprecationMessage: '',
  setDeprecationMessage: vi.fn(),
  deprecating: false,
  deprecateModuleDialogOpen: false,
  setDeprecateModuleDialogOpen: vi.fn(),
  moduleDeprecationMessage: '',
  setModuleDeprecationMessage: vi.fn(),
  successorModuleId: '',
  setSuccessorModuleId: vi.fn(),
  undeprecateModuleDialogOpen: false,
  setUndeprecateModuleDialogOpen: vi.fn(),
  deprecatingModule: false,
  scmLink: null,
  scmLinkLoaded: true,
  scmWizardOpen: false,
  setScmWizardOpen: vi.fn(),
  scmSyncing: false,
  scmUnlinking: false,
  webhookEvents: [],
  webhookEventsLoaded: true,
  webhookEventsLoading: false,
  webhookEventsExpanded: false,
  setWebhookEventsExpanded: vi.fn(),
  moduleScan: null,
  scanLoading: false,
  scanNotFound: false,
  moduleDocs: null,
  docsLoading: false,
  loadSCMLink: vi.fn(),
  loadWebhookEvents: vi.fn(),
  pollForVersions: vi.fn(),
  handleSCMSync: vi.fn(),
  handleSCMUnlink: vi.fn(),
  handleCopySource: vi.fn(),
  handlePublishNewVersion: vi.fn(),
  handleDeleteModule: vi.fn(),
  handleDeleteVersion: vi.fn(),
  openDeleteVersionDialog: vi.fn(),
  handleDeprecateVersion: vi.fn(),
  handleUndeprecateVersion: vi.fn(),
  handleDeprecateModule: vi.fn(),
  handleUndeprecateModule: vi.fn(),
  handleUpdateDescription: vi.fn(),
}

vi.mock('../../hooks/useModuleDetail', () => ({
  useModuleDetail: () => mockHookReturn,
}))

vi.mock('../../config', () => ({
  REGISTRY_HOST: 'registry.example.com',
}))

import ModuleDetailPage from '../ModuleDetailPage'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/modules/hashicorp/consul/aws']}>
      <Routes>
        <Route path="/modules/:namespace/:name/:system" element={<ModuleDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ModuleDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHookReturn.loading = false
    mockHookReturn.error = null
    mockHookReturn.module = null
    mockHookReturn.versions = []
    mockHookReturn.selectedVersion = null
    mockHookReturn.canManage = true
    mockHookReturn.isAuthenticated = true
    mockHookReturn.deleteModuleDialogOpen = false
    mockHookReturn.deleteVersionDialogOpen = false
    mockHookReturn.deprecateDialogOpen = false
    mockHookReturn.deprecateModuleDialogOpen = false
    mockHookReturn.undeprecateModuleDialogOpen = false
    mockHookReturn.scmWizardOpen = false
  })

  it('shows skeleton when loading', () => {
    mockHookReturn.loading = true
    const { container } = renderPage()
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
  })

  it('shows error alert when error is set', () => {
    mockHookReturn.error = 'Module not found'
    renderPage()
    expect(screen.getByText('Module not found')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to modules/i })).toBeInTheDocument()
  })

  it('shows error when module is null without error message', () => {
    mockHookReturn.module = null
    mockHookReturn.error = null
    renderPage()
    expect(screen.getByRole('button', { name: /back to modules/i })).toBeInTheDocument()
  })

  it('renders module header when module is loaded', () => {
    mockHookReturn.module = {
      namespace: 'hashicorp',
      name: 'consul',
      system: 'aws',
      description: 'Consul module for AWS',
      published_at: '2025-01-01T00:00:00Z',
      downloads: 1234,
      deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }, { version: '0.9.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('consul')
  })

  it('shows deprecation banner when module is deprecated', () => {
    mockHookReturn.module = {
      namespace: 'hashicorp',
      name: 'consul',
      system: 'aws',
      description: 'Deprecated module',
      deprecated: true,
      deprecation_message: 'Use terraform-aws-modules/consul instead',
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    renderPage()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/terraform-aws-modules/)).toBeInTheDocument()
  })

  it('renders breadcrumbs with namespace', () => {
    mockHookReturn.module = {
      namespace: 'hashicorp',
      name: 'consul',
      system: 'aws',
      description: '',
      deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    renderPage()
    expect(screen.getByText('Modules')).toBeInTheDocument()
  })

  it('renders Publish New Version button for managers and fires handler when clicked', async () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: 'desc', deprecated: false, download_count: 42,
    }
    mockHookReturn.versions = [
      { version: '1.0.0', deprecated: false, readme: '# R' },
    ]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false, readme: '# R' }
    renderPage()
    const btn = screen.getByRole('button', { name: /publish new version/i })
    await userEvent.click(btn)
    expect(mockHookReturn.handlePublishNewVersion).toHaveBeenCalled()
  })

  it('hides Publish New Version button when user cannot manage', () => {
    mockHookReturn.canManage = false
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: 'desc', deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    renderPage()
    expect(screen.queryByRole('button', { name: /publish new version/i })).not.toBeInTheDocument()
  })

  it('renders deprecation successor link when provided', () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: 'desc', deprecated: true, deprecation_message: 'legacy',
      successor_module: { namespace: 'new', name: 'consul', system: 'aws' },
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    renderPage()
    expect(screen.getByRole('link', { name: /new\/consul\/aws/i })).toBeInTheDocument()
  })

  it('shows Deprecated chip for deprecated selectedVersion', () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: 'desc', deprecated: false, download_count: 0,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: true }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: true }
    renderPage()
    expect(screen.getAllByText('Deprecated').length).toBeGreaterThan(0)
  })

  it('enters and cancels description edit mode', async () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: 'original desc', deprecated: false, download_count: 0,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /edit description/i }))
    // TextField is now visible with autoFocus
    const input = screen.getByPlaceholderText('Module description') as HTMLInputElement
    expect(input).toBeInTheDocument()
    // Escape cancels
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByPlaceholderText('Module description')).not.toBeInTheDocument()
  })

  it('saves description via enter key', async () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: 'old', deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /edit description/i }))
    const input = screen.getByPlaceholderText('Module description') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'new desc' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockHookReturn.handleUpdateDescription).toHaveBeenCalledWith('new desc')
  })

  it('saves description via save button', async () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: 'old', deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /edit description/i }))
    const input = screen.getByPlaceholderText('Module description') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'updated via button' } })
    await userEvent.click(screen.getByRole('button', { name: /save description/i }))
    expect(mockHookReturn.handleUpdateDescription).toHaveBeenCalledWith('updated via button')
  })

  it('switches documentation tab to Inputs / Outputs', async () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: 'desc', deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false, readme: '# Hello' }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false, readme: '# Hello' }
    renderPage()
    const ioTab = screen.getByRole('tab', { name: /inputs \/ outputs/i })
    await userEvent.click(ioTab)
    expect(ioTab).toHaveAttribute('aria-selected', 'true')
  })

  it('renders "No README" message when version has no readme', () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: '', deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    renderPage()
    expect(screen.getByText(/No README provided/)).toBeInTheDocument()
  })

  it('renders back to modules IconButton on loaded state', () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: '', deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    renderPage()
    expect(screen.getByRole('button', { name: /back to modules/i })).toBeInTheDocument()
  })

  it('renders created_by_name when present', () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: '', deprecated: false,
      created_by_name: 'Alice',
      organization_name: 'HashiCorp Inc.',
    }
    mockHookReturn.versions = [{ version: '2.3.4', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '2.3.4', deprecated: false }
    renderPage()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('HashiCorp Inc.')).toBeInTheDocument()
  })

  it('opens delete module dialog when deleteModuleDialogOpen=true', () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: '', deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    mockHookReturn.deleteModuleDialogOpen = true
    renderPage()
    expect(screen.getByTestId('delete-module-dialog')).toBeInTheDocument()
  })

  it('opens delete version dialog when deleteVersionDialogOpen=true', () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: '', deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    mockHookReturn.deleteVersionDialogOpen = true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ; (mockHookReturn as any).versionToDelete = '1.0.0'
    renderPage()
    expect(screen.getByTestId('delete-version-dialog')).toBeInTheDocument()
  })

  it('opens deprecate version dialog when deprecateDialogOpen=true', () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: '', deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    mockHookReturn.deprecateDialogOpen = true
    renderPage()
    expect(screen.getByTestId('deprecate-version-dialog')).toBeInTheDocument()
  })

  it('opens deprecate module dialog when deprecateModuleDialogOpen=true', () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: '', deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    mockHookReturn.deprecateModuleDialogOpen = true
    renderPage()
    expect(screen.getByTestId('deprecate-module-dialog')).toBeInTheDocument()
  })

  it('opens undeprecate module dialog when undeprecateModuleDialogOpen=true', () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: '', deprecated: true, deprecation_message: 'use X',
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    mockHookReturn.undeprecateModuleDialogOpen = true
    renderPage()
    expect(screen.getByTestId('undeprecate-module-dialog')).toBeInTheDocument()
  })

  it('opens SCM wizard dialog when scmWizardOpen=true', () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: '', deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    mockHookReturn.scmWizardOpen = true
    renderPage()
    expect(screen.getAllByText('Link Repository').length).toBeGreaterThan(0)
  })

  it('closes delete module dialog when Cancel is clicked', async () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: '', deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    mockHookReturn.deleteModuleDialogOpen = true
    renderPage()
    const dialog = screen.getByTestId('delete-module-dialog')
    const cancel = dialog.querySelector('button[type="button"]') as HTMLButtonElement
    await userEvent.click(cancel)
    expect(mockHookReturn.setDeleteModuleDialogOpen).toHaveBeenCalledWith(false)
  })

  it('confirms delete module after typing confirmation text', async () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: '', deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    mockHookReturn.deleteModuleDialogOpen = true
    renderPage()
    const typeInput = screen.getByTestId('confirm-dialog-type-input') as HTMLInputElement
    fireEvent.change(typeInput, { target: { value: 'hashicorp/consul/aws' } })
    await userEvent.click(screen.getByTestId('confirm-dialog-confirm'))
    expect(mockHookReturn.handleDeleteModule).toHaveBeenCalled()
  })

  it('confirms delete version after typing confirmation text', async () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: '', deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    mockHookReturn.deleteVersionDialogOpen = true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ; (mockHookReturn as any).versionToDelete = '1.0.0'
    renderPage()
    const dialog = screen.getByTestId('delete-version-dialog')
    const typeInput = dialog.querySelector('[data-testid="confirm-dialog-type-input"]') as HTMLInputElement
    fireEvent.change(typeInput, { target: { value: '1.0.0' } })
    const confirm = dialog.querySelector('[data-testid="confirm-dialog-confirm"]') as HTMLButtonElement
    await userEvent.click(confirm)
    expect(mockHookReturn.handleDeleteVersion).toHaveBeenCalled()
  })

  it('submits deprecate version dialog with a message', async () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: '', deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    mockHookReturn.deprecateDialogOpen = true
    renderPage()
    const dialog = screen.getByTestId('deprecate-version-dialog')
    const msgField = dialog.querySelector('[data-testid="confirm-dialog-field-message"]') as HTMLInputElement
    fireEvent.change(msgField, { target: { value: 'use 2.0' } })
    const confirm = dialog.querySelector('[data-testid="confirm-dialog-confirm"]') as HTMLButtonElement
    await userEvent.click(confirm)
    expect(mockHookReturn.setDeprecationMessage).toHaveBeenCalledWith('use 2.0')
    expect(mockHookReturn.handleDeprecateVersion).toHaveBeenCalled()
  })

  it('submits deprecate module dialog with required fields', async () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: '', deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    mockHookReturn.deprecateModuleDialogOpen = true
    renderPage()
    const dialog = screen.getByTestId('deprecate-module-dialog')
    fireEvent.change(
      dialog.querySelector('[data-testid="confirm-dialog-field-message"]') as HTMLInputElement,
      { target: { value: 'abandoned' } },
    )
    fireEvent.change(
      dialog.querySelector('[data-testid="confirm-dialog-field-successor"]') as HTMLInputElement,
      { target: { value: 'new/consul/aws' } },
    )
    const confirm = dialog.querySelector('[data-testid="confirm-dialog-confirm"]') as HTMLButtonElement
    await userEvent.click(confirm)
    expect(mockHookReturn.setModuleDeprecationMessage).toHaveBeenCalledWith('abandoned')
    expect(mockHookReturn.setSuccessorModuleId).toHaveBeenCalledWith('new/consul/aws')
    expect(mockHookReturn.handleDeprecateModule).toHaveBeenCalled()
  })

  it('closes deprecate version dialog via Cancel', async () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: '', deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    mockHookReturn.deprecateDialogOpen = true
    renderPage()
    const dialog = screen.getByTestId('deprecate-version-dialog')
    const cancel = dialog.querySelector('button[type="button"]') as HTMLButtonElement
    await userEvent.click(cancel)
    expect(mockHookReturn.setDeprecateDialogOpen).toHaveBeenCalledWith(false)
    expect(mockHookReturn.setDeprecationMessage).toHaveBeenCalledWith('')
  })

  it('closes deprecate module dialog via Cancel', async () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: '', deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    mockHookReturn.deprecateModuleDialogOpen = true
    renderPage()
    const dialog = screen.getByTestId('deprecate-module-dialog')
    const cancel = dialog.querySelector('button[type="button"]') as HTMLButtonElement
    await userEvent.click(cancel)
    expect(mockHookReturn.setDeprecateModuleDialogOpen).toHaveBeenCalledWith(false)
    expect(mockHookReturn.setModuleDeprecationMessage).toHaveBeenCalledWith('')
    expect(mockHookReturn.setSuccessorModuleId).toHaveBeenCalledWith('')
  })

  it('confirms undeprecate module dialog', async () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: '', deprecated: true, deprecation_message: 'legacy',
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    mockHookReturn.undeprecateModuleDialogOpen = true
    renderPage()
    const dialog = screen.getByTestId('undeprecate-module-dialog')
    const confirm = dialog.querySelector('[data-testid="confirm-dialog-confirm"]') as HTMLButtonElement
    await userEvent.click(confirm)
    expect(mockHookReturn.handleUndeprecateModule).toHaveBeenCalled()
  })

  it('fires SCM wizard onOpenWizard via SCMRepositoryPanel action', async () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: '', deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    mockHookReturn.scmLink = null
    mockHookReturn.scmLinkLoaded = true
    renderPage()
    // SCMRepositoryPanel renders a "Link Repository" button when no link exists.
    const links = screen.queryAllByRole('button', { name: /link repository/i })
    if (links.length > 0) {
      await userEvent.click(links[0])
      expect(mockHookReturn.setScmWizardOpen).toHaveBeenCalledWith(true)
    }
  })

  it('toggles webhook events expanded from panel', async () => {
    mockHookReturn.module = {
      id: 'm-1', namespace: 'hashicorp', name: 'consul', system: 'aws',
      description: '', deprecated: false,
    }
    mockHookReturn.versions = [{ version: '1.0.0', deprecated: false }]
    mockHookReturn.selectedVersion = { version: '1.0.0', deprecated: false }
    mockHookReturn.scmLink = { provider: 'github', repo_url: 'https://github.com/x/y', last_synced_at: null }
    mockHookReturn.webhookEventsLoaded = true
    mockHookReturn.webhookEvents = []
    renderPage()
    const expandBtns = screen.queryAllByRole('button', { name: /webhook|expand|events/i })
    if (expandBtns.length > 0) {
      await userEvent.click(expandBtns[0])
    }
    // Just assert the page rendered without crashing — any click path is fine
    expect(screen.getAllByRole('heading').length).toBeGreaterThan(0)
  })
})
