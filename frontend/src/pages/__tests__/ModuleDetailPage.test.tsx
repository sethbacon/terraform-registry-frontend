import { render, screen } from '@testing-library/react'
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
  versions: [] as string[],
  selectedVersion: '',
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
    mockHookReturn.selectedVersion = ''
    mockHookReturn.canManage = true
    mockHookReturn.isAuthenticated = true
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
    mockHookReturn.versions = ['1.0.0', '0.9.0']
    mockHookReturn.selectedVersion = '1.0.0'
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
    mockHookReturn.versions = ['1.0.0']
    mockHookReturn.selectedVersion = '1.0.0'
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
    mockHookReturn.versions = ['1.0.0']
    mockHookReturn.selectedVersion = '1.0.0'
    renderPage()
    expect(screen.getByText('Modules')).toBeInTheDocument()
  })
})
