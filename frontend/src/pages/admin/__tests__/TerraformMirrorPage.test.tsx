import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const listTerraformMirrorConfigsMock = vi.fn()
const getTerraformMirrorStatusMock = vi.fn()
const createMirrorMock = vi.fn()
const updateMirrorMock = vi.fn()
const deleteMirrorMock = vi.fn()
const triggerSyncMock = vi.fn()
const listVersionsMock = vi.fn()
const listVersionPlatformsMock = vi.fn()
const deleteVersionMock = vi.fn()
const getHistoryMock = vi.fn()
const getReleasesGPGKeysMock = vi.fn()

vi.mock('../../../services/api', () => ({
  default: {
    listTerraformMirrorConfigs: (...args: unknown[]) => listTerraformMirrorConfigsMock(...args),
    getTerraformMirrorStatus: (...args: unknown[]) => getTerraformMirrorStatusMock(...args),
    createTerraformMirrorConfig: (...args: unknown[]) => createMirrorMock(...args),
    updateTerraformMirrorConfig: (...args: unknown[]) => updateMirrorMock(...args),
    deleteTerraformMirrorConfig: (...args: unknown[]) => deleteMirrorMock(...args),
    triggerTerraformMirrorSync: (...args: unknown[]) => triggerSyncMock(...args),
    listTerraformVersions: (...args: unknown[]) => listVersionsMock(...args),
    listTerraformVersionPlatforms: (...args: unknown[]) => listVersionPlatformsMock(...args),
    deleteTerraformVersion: (...args: unknown[]) => deleteVersionMock(...args),
    getTerraformMirrorHistory: (...args: unknown[]) => getHistoryMock(...args),
    // The page renders <ReleasesGPGKeyStatus />, which calls this. Leaving it out
    // makes the call a TypeError, so that panel renders its own "Failed to load
    // GPG key status." alert in every test here — a second element matching any
    // loose /error|failed/ assertion.
    getReleasesGPGKeys: (...args: unknown[]) => getReleasesGPGKeysMock(...args),
  },
}))

let mockAllowedScopes: string[] = ['admin']

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ allowedScopes: mockAllowedScopes, user: { id: 'u1' } }),
}))

import TerraformMirrorPage from '../../admin/TerraformMirrorPage'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
}

function renderPage() {
  const qc = createQueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TerraformMirrorPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const fakeConfigs = [
  {
    id: 'tm-1',
    name: 'terraform',
    tool: 'terraform',
    description: 'Terraform binary mirror',
    upstream_url: 'https://releases.hashicorp.com/terraform',
    enabled: true,
    auto_sync: true,
    created_at: '2025-01-01T00:00:00Z',
    version_count: 5,
    platform_count: 20,
  },
]

describe('TerraformMirrorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAllowedScopes = ['admin']
    getTerraformMirrorStatusMock.mockResolvedValue({
      status: 'idle',
      version_count: 3,
      platform_count: 6,
      pending_count: 1,
      last_sync: '2025-06-01T00:00:00Z',
    })
    listVersionsMock.mockResolvedValue({ versions: [] })
    listVersionPlatformsMock.mockResolvedValue({ platforms: [] })
    getHistoryMock.mockResolvedValue({ history: [] })
    getReleasesGPGKeysMock.mockResolvedValue({ keys: [] })
  })

  it('shows loading spinner initially', () => {
    listTerraformMirrorConfigsMock.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows empty state when no configs', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: [] })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/no.*mirror.*config/i)).toBeInTheDocument()
    })
  })

  it('renders config cards after loading', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByText('terraform').length).toBeGreaterThan(0)
    })
  })

  it('shows Add button', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: [] })
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add|create|new/i })).toBeInTheDocument()
    })
  })

  it('shows error state on API failure', async () => {
    listTerraformMirrorConfigsMock.mockRejectedValue(new Error('Server error'))
    renderPage()
    // Assert the page's own alert text exactly. A loose /error|failed/ regex also
    // matches any other alert on the page, and getByText throws on multiple
    // matches — so the assertion only held in the window before the second alert
    // rendered, which a loaded parallel worker can miss.
    expect(await screen.findByText('Server error')).toBeInTheDocument()
  })

  it('renders page heading', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Terraform.*Mirror/i)).toBeInTheDocument()
    })
  })

  it('opens Create mirror dialog when Add is clicked', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: [] })
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add.*mirror/i })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('button', { name: /add.*mirror/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })

  it('offers terraform-docs as a tool option in the Create dialog', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: [] })
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add mirror/i })).toBeInTheDocument(),
    )
    await userEvent.click(screen.getByRole('button', { name: /add mirror/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('combobox', { name: /tool/i }))
    expect(screen.getByRole('option', { name: 'terraform-docs' })).toBeInTheDocument()
  })

  it('auto-fills the terraform-docs upstream URL when the tool is selected', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: [] })
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add mirror/i })).toBeInTheDocument(),
    )
    await userEvent.click(screen.getByRole('button', { name: /add mirror/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('combobox', { name: /tool/i }))
    await userEvent.click(screen.getByRole('option', { name: 'terraform-docs' }))
    expect(
      screen.getByDisplayValue('https://github.com/terraform-docs/terraform-docs'),
    ).toBeInTheDocument()
  })

  it('opens edit dialog via Edit mirror action', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    const editBtn = screen.getByRole('button', { name: /edit mirror/i })
    await userEvent.click(editBtn)
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })

  it('opens delete dialog via Delete mirror action', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    const delBtn = screen.getByRole('button', { name: /delete mirror/i })
    await userEvent.click(delBtn)
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })

  it('triggers sync via Sync mirror action', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    triggerSyncMock.mockResolvedValue({ triggered: true })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    const syncBtn = screen.getByRole('button', { name: /^sync mirror$/i })
    await userEvent.click(syncBtn)
    await waitFor(() => expect(triggerSyncMock).toHaveBeenCalledWith('tm-1'))
  })

  it('opens versions dialog via View Details', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    listVersionsMock.mockResolvedValue({
      versions: [
        {
          version: '1.5.0',
          sync_status: 'synced',
          is_latest: true,
          is_deprecated: false,
          synced_at: '2025-06-01T00:00:00Z',
        },
      ],
    })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /view details/i }))
    await waitFor(() => expect(listVersionsMock).toHaveBeenCalledWith('tm-1', { synced: false }))
  })

  it('opens history dialog via View sync history', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    getHistoryMock.mockResolvedValue({
      history: [
        {
          id: 'h-1',
          started_at: '2025-06-01T00:00:00Z',
          completed_at: '2025-06-01T00:01:00Z',
          sync_status: 'success',
          versions_added: 1,
          versions_updated: 0,
          error_message: null,
        },
      ],
    })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /view sync history/i }))
    await waitFor(() => expect(getHistoryMock).toHaveBeenCalledWith('tm-1', 20))
  })

  it('renders "never synced" when config has no last_sync_status', async () => {
    const noSyncConfig = [
      {
        ...fakeConfigs[0],
        last_sync_status: null,
        last_sync_at: null,
      },
    ]
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: noSyncConfig })
    renderPage()
    await waitFor(() => expect(screen.getByText(/never synced/i)).toBeInTheDocument())
  })

  it('renders disabled chip for disabled configs', async () => {
    const disabledConfig = [
      {
        ...fakeConfigs[0],
        enabled: false,
      },
    ]
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: disabledConfig })
    renderPage()
    await waitFor(() => expect(screen.getByText('disabled')).toBeInTheDocument())
  })

  it('renders version/platform status chips from status endpoint', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/3 versions/i)).toBeInTheDocument()
      expect(screen.getByText(/6 platforms/i)).toBeInTheDocument()
      expect(screen.getByText(/1 pending/i)).toBeInTheDocument()
    })
  })

  it('creates a mirror via Add dialog', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: [] })
    createMirrorMock.mockResolvedValue({ id: 'new-id' })
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add mirror/i })).toBeInTheDocument(),
    )
    await userEvent.click(screen.getByRole('button', { name: /add mirror/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const nameInput = screen.getByLabelText(/^Name/i)
    await userEvent.type(nameInput, 'my-tf')
    const createBtn = screen.getByRole('button', { name: /^create$/i })
    await userEvent.click(createBtn)
    await waitFor(() => expect(createMirrorMock).toHaveBeenCalled())
  })

  it('defaults a new mirror to stable-only and requires-approval', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: [] })
    createMirrorMock.mockResolvedValue({ id: 'new-id' })
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add mirror/i })).toBeInTheDocument(),
    )
    await userEvent.click(screen.getByRole('button', { name: /add mirror/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await userEvent.type(screen.getByLabelText(/^Name/i), 'defaults-tf')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))
    await waitFor(() => expect(createMirrorMock).toHaveBeenCalled())
    expect(createMirrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ stable_only: true, requires_approval: true }),
    )
  })

  it('shows error when create mirror fails', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: [] })
    createMirrorMock.mockRejectedValue(new Error('create failed'))
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add mirror/i })).toBeInTheDocument(),
    )
    await userEvent.click(screen.getByRole('button', { name: /add mirror/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await userEvent.type(screen.getByLabelText(/^Name/i), 'x')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))
    await waitFor(() => expect(screen.getByText(/create failed/i)).toBeInTheDocument())
  })

  it('saves edit via Edit dialog', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    updateMirrorMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /edit mirror/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(updateMirrorMock).toHaveBeenCalledWith('tm-1', expect.any(Object)))
  })

  it('confirms delete via Delete dialog', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    deleteMirrorMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /delete mirror/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const deleteBtns = screen.getAllByRole('button', { name: /^delete$/i })
    await userEvent.click(deleteBtns[deleteBtns.length - 1])
    await waitFor(() => expect(deleteMirrorMock).toHaveBeenCalledWith('tm-1'))
  })

  it('cancels create dialog', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: [] })
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add mirror/i })).toBeInTheDocument(),
    )
    await userEvent.click(screen.getByRole('button', { name: /add mirror/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('renders synced versions in versions dialog', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    listVersionsMock.mockResolvedValue({
      versions: [
        {
          id: 'v1',
          version: '1.5.0',
          sync_status: 'synced',
          is_latest: true,
          is_deprecated: false,
          synced_at: '2025-06-01T00:00:00Z',
        },
        {
          id: 'v2',
          version: '1.4.0',
          sync_status: 'pending',
          is_latest: false,
          is_deprecated: false,
          synced_at: null,
        },
      ],
    })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /view details/i }))
    await waitFor(() => expect(screen.getByText('1.5.0')).toBeInTheDocument())
    expect(screen.getByText('1.4.0')).toBeInTheDocument()
  })

  it('shows "no versions synced" in empty versions dialog', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    listVersionsMock.mockResolvedValue({ versions: [] })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /view details/i }))
    await waitFor(() =>
      expect(screen.getByText(/no versions have been synced/i)).toBeInTheDocument(),
    )
  })

  it('renders sync history entries', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    getHistoryMock.mockResolvedValue({
      history: [
        {
          id: 'h-1',
          started_at: '2025-06-01T00:00:00Z',
          completed_at: '2025-06-01T00:01:00Z',
          sync_status: 'success',
          versions_added: 2,
          versions_updated: 1,
          error_message: null,
        },
        {
          id: 'h-2',
          started_at: '2025-06-02T00:00:00Z',
          completed_at: null,
          sync_status: 'failed',
          versions_added: 0,
          versions_updated: 0,
          error_message: 'Network timeout',
        },
      ],
    })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /view sync history/i }))
    await waitFor(() => expect(getHistoryMock).toHaveBeenCalled())
  })

  it('closes versions dialog via Close button', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    listVersionsMock.mockResolvedValue({
      versions: [
        {
          id: 'v1',
          version: '1.5.0',
          sync_status: 'synced',
          is_latest: true,
          is_deprecated: false,
          synced_at: '2025-06-01T00:00:00Z',
        },
      ],
    })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /view details/i }))
    await waitFor(() => expect(screen.getByText('1.5.0')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^close$/i }))
    await waitFor(() => expect(screen.queryByText('1.5.0')).not.toBeInTheDocument())
  })

  it('shows error when sync fails', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    triggerSyncMock.mockRejectedValue(new Error('sync failed'))
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /^sync mirror$/i }))
    await waitFor(() => expect(screen.getByText(/sync failed/i)).toBeInTheDocument())
  })

  it('changes tool in Add dialog updates upstream URL', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: [] })
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add mirror/i })).toBeInTheDocument(),
    )
    await userEvent.click(screen.getByRole('button', { name: /add mirror/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const toolSelect = screen.getByLabelText(/^Tool/i)
    await userEvent.click(toolSelect)
    const opentofu = await screen.findByRole('option', { name: /opentofu/i })
    await userEvent.click(opentofu)
    await waitFor(() => {
      const url = screen.getByLabelText(/Upstream URL/i) as HTMLInputElement
      expect(url.value).toContain('opentofu')
    })
  })

  it('triggers refresh button to invalidate query', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    listTerraformMirrorConfigsMock.mockClear()
    await userEvent.click(screen.getByRole('button', { name: /refresh/i }))
    await waitFor(() => expect(listTerraformMirrorConfigsMock).toHaveBeenCalled())
  })

  it('opens delete version dialog and confirms deletion', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    listVersionsMock.mockResolvedValue({
      versions: [
        {
          id: 'v1',
          version: '1.5.0',
          sync_status: 'synced',
          is_latest: true,
          is_deprecated: false,
          synced_at: '2025-06-01T00:00:00Z',
        },
      ],
    })
    deleteVersionMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /view details/i }))
    await waitFor(() => expect(screen.getByText('1.5.0')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /delete version/i }))
    await waitFor(() => expect(screen.getByText(/Delete Terraform Version/i)).toBeInTheDocument())
    const dialogs = screen.getAllByRole('dialog')
    const deleteDialog = dialogs[dialogs.length - 1]
    const deleteBtn = deleteDialog.querySelector(
      'button[class*="MuiButton-colorError"]',
    ) as HTMLButtonElement
    await userEvent.click(deleteBtn)
    await waitFor(() => expect(deleteVersionMock).toHaveBeenCalledWith('tm-1', '1.5.0'))
  })

  it('cancels delete version dialog', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    listVersionsMock.mockResolvedValue({
      versions: [
        {
          id: 'v1',
          version: '1.5.0',
          sync_status: 'synced',
          is_latest: true,
          is_deprecated: false,
          synced_at: '2025-06-01T00:00:00Z',
        },
      ],
    })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /view details/i }))
    await waitFor(() => expect(screen.getByText('1.5.0')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /delete version/i }))
    await waitFor(() => expect(screen.getByText(/Delete Terraform Version/i)).toBeInTheDocument())
    const cancelBtns = screen.getAllByRole('button', { name: /^cancel$/i })
    await userEvent.click(cancelBtns[cancelBtns.length - 1])
    await waitFor(() =>
      expect(screen.queryByText(/Delete Terraform Version/i)).not.toBeInTheDocument(),
    )
    expect(deleteVersionMock).not.toHaveBeenCalled()
  })

  it('expands version row to fetch platforms', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    listVersionsMock.mockResolvedValue({
      versions: [
        {
          id: 'v1',
          version: '1.5.0',
          sync_status: 'synced',
          is_latest: true,
          is_deprecated: false,
          synced_at: '2025-06-01T00:00:00Z',
        },
      ],
    })
    listVersionPlatformsMock.mockResolvedValue([
      {
        id: 'p-1',
        os: 'linux',
        arch: 'amd64',
        sync_status: 'synced',
        filename: 'terraform_1.5.0_linux_amd64.zip',
        sha256_verified: true,
        gpg_verified: false,
      },
    ])
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /view details/i }))
    await waitFor(() => expect(screen.getByText('1.5.0')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /toggle version details/i }))
    await waitFor(() => expect(listVersionPlatformsMock).toHaveBeenCalledWith('tm-1', '1.5.0'))
    await waitFor(() => expect(screen.getByText('linux')).toBeInTheDocument())
  })

  it('expanded row handles platforms fetch failure gracefully', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    listVersionsMock.mockResolvedValue({
      versions: [
        {
          id: 'v1',
          version: '1.5.0',
          sync_status: 'synced',
          is_latest: true,
          is_deprecated: false,
          synced_at: '2025-06-01T00:00:00Z',
        },
      ],
    })
    listVersionPlatformsMock.mockRejectedValue(new Error('boom'))
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /view details/i }))
    await waitFor(() => expect(screen.getByText('1.5.0')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /toggle version details/i }))
    await waitFor(() => expect(screen.getByText(/No platforms synced yet/i)).toBeInTheDocument())
  })

  it('closes history dialog via Close button', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    getHistoryMock.mockResolvedValue({
      history: [
        {
          id: 'h-1',
          started_at: '2025-06-01T00:00:00Z',
          completed_at: '2025-06-01T00:01:00Z',
          status: 'success',
          triggered_by: 'scheduler',
          versions_synced: 2,
          platforms_synced: 4,
          versions_failed: 0,
        },
      ],
    })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /view sync history/i }))
    await waitFor(() => expect(getHistoryMock).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText(/Sync History — terraform/i)).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^close$/i }))
    await waitFor(() =>
      expect(screen.queryByText(/Sync History — terraform/i)).not.toBeInTheDocument(),
    )
  })

  it('history dialog shows "no history yet" on empty result', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    getHistoryMock.mockResolvedValue({ history: [] })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /view sync history/i }))
    await waitFor(() => expect(screen.getByText(/No sync history yet/i)).toBeInTheDocument())
  })

  it('cancels delete mirror dialog without action', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /delete mirror/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(deleteMirrorMock).not.toHaveBeenCalled()
  })

  it('cancels edit mirror dialog without action', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /edit mirror/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateMirrorMock).not.toHaveBeenCalled()
  })

  it('shows requires approval switch in create dialog', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: [] })
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /add/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByText('Require approval for new versions')).toBeInTheDocument()
  })

  it('shows requires approval switch in edit dialog', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /edit mirror/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByText('Require approval for new versions')).toBeInTheDocument()
  })

  it('shows approval status chip in versions dialog for pending versions', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    listVersionsMock.mockResolvedValue({
      versions: [
        {
          id: 'v1',
          version: '1.5.0',
          sync_status: 'synced',
          is_latest: false,
          is_deprecated: false,
          synced_at: '2025-06-01T00:00:00Z',
          approval_status: 'pending_approval',
        },
      ],
    })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /view details/i }))
    await waitFor(() => expect(screen.getByText('1.5.0')).toBeInTheDocument())
    expect(screen.getByText('Pending Approval')).toBeInTheDocument()
  })

  // ── canManage gates mirror-config CRUD/sync + delete-version (#609) ────────

  it('hides Add/Edit/Delete/Sync mirror and Delete version controls for the mirrors:read scope', async () => {
    mockAllowedScopes = ['mirrors:read']
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    listVersionsMock.mockResolvedValue({
      versions: [
        {
          id: 'v1',
          version: '1.5.0',
          sync_status: 'synced',
          is_latest: true,
          is_deprecated: false,
          synced_at: '2025-06-01T00:00:00Z',
        },
      ],
    })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))

    // View access is unaffected — the viewer still sees the config card.
    expect(screen.queryByRole('button', { name: /add mirror/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit mirror/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete mirror/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^sync mirror$/i })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /view details/i }))
    await waitFor(() => expect(screen.getByText('1.5.0')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /delete version/i })).not.toBeInTheDocument()
  })

  it('shows Add/Edit/Delete/Sync mirror and Delete version controls for the canonical mirrors:manage scope', async () => {
    mockAllowedScopes = ['mirrors:manage']
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    listVersionsMock.mockResolvedValue({
      versions: [
        {
          id: 'v1',
          version: '1.5.0',
          sync_status: 'synced',
          is_latest: true,
          is_deprecated: false,
          synced_at: '2025-06-01T00:00:00Z',
        },
      ],
    })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))

    expect(screen.getByRole('button', { name: /add mirror/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit mirror/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete mirror/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^sync mirror$/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /view details/i }))
    await waitFor(() => expect(screen.getByText('1.5.0')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /delete version/i })).toBeInTheDocument()
  })

  // ── behaviour the #675 dialog-flow extraction had to carry across ─────────
  //
  // Each of these locks a specific transition that moving a flow into its own
  // hook could have silently dropped. They assert on the exact banner/field
  // text, never on a loose /error|failed/ — the GPG panel renders its own
  // failure alert in every test in this file.

  it('leaves an earlier error banner on screen when a later action succeeds', async () => {
    // Divergence, preserved deliberately: every flow on this page reports
    // success with status.setSuccess, where six sibling admin pages use
    // showSuccess (which also clears the error). Swapping this page to
    // showSuccess would remove the "sync failed" banner below.
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    triggerSyncMock.mockRejectedValue(new Error('sync failed'))
    createMirrorMock.mockResolvedValue({ id: 'new-id' })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))

    await userEvent.click(screen.getByRole('button', { name: /^sync mirror$/i }))
    await waitFor(() => expect(screen.getByText('sync failed')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /add mirror/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await userEvent.type(screen.getByLabelText(/^Name/i), 'later-tf')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() => expect(screen.getByText('Mirror "later-tf" created')).toBeInTheDocument())
    expect(screen.getByText('sync failed')).toBeInTheDocument()
  })

  it('blanks a cancelled draft when the create dialog is reopened', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: [] })
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add mirror/i })).toBeInTheDocument(),
    )

    await userEvent.click(screen.getByRole('button', { name: /add mirror/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await userEvent.type(screen.getByLabelText(/^Name/i), 'abandoned-draft')
    await userEvent.type(screen.getByLabelText(/version filter/i), '~> 1.5')
    expect(screen.getByLabelText(/^Name/i)).toHaveValue('abandoned-draft')
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /add mirror/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByLabelText(/^Name/i)).toHaveValue('')
    expect(screen.getByLabelText(/version filter/i)).toHaveValue('')
  })

  it('reloads the versions list after a version is deleted', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    listVersionsMock.mockResolvedValue({
      versions: [
        {
          id: 'v1',
          version: '1.5.0',
          sync_status: 'synced',
          is_latest: true,
          is_deprecated: false,
          synced_at: '2025-06-01T00:00:00Z',
        },
      ],
    })
    deleteVersionMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /view details/i }))
    await waitFor(() => expect(listVersionsMock).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByRole('button', { name: /delete version/i }))
    await waitFor(() => expect(screen.getByText(/Delete Terraform Version/i)).toBeInTheDocument())
    const dialogs = screen.getAllByRole('dialog')
    const deleteBtn = dialogs[dialogs.length - 1].querySelector(
      'button[class*="MuiButton-colorError"]',
    ) as HTMLButtonElement
    await userEvent.click(deleteBtn)

    await waitFor(() => expect(screen.getByText('Version 1.5.0 deleted')).toBeInTheDocument())
    // The browser behind the confirmation refetches so the deleted row goes away.
    await waitFor(() => expect(listVersionsMock).toHaveBeenCalledTimes(2))
    expect(listVersionsMock).toHaveBeenLastCalledWith('tm-1', { synced: false })
  })

  it('shows an empty versions table, and no banner, when the versions load fails', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    listVersionsMock.mockRejectedValue(new Error('versions boom'))
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /view details/i }))
    await waitFor(() =>
      expect(screen.getByText('No versions have been synced yet.')).toBeInTheDocument(),
    )
    expect(screen.queryByText('versions boom')).not.toBeInTheDocument()
  })

  it('shows an empty history table, and no banner, when the history load fails', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    getHistoryMock.mockRejectedValue(new Error('history boom'))
    renderPage()
    await waitFor(() => expect(screen.getAllByText('terraform').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /view sync history/i }))
    await waitFor(() => expect(screen.getByText('No sync history yet.')).toBeInTheDocument())
    expect(screen.queryByText('history boom')).not.toBeInTheDocument()
  })
})
