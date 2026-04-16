import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

const listMirrorsMock = vi.fn()
const createMirrorMock = vi.fn()
const updateMirrorMock = vi.fn()
const deleteMirrorMock = vi.fn()
const triggerMirrorSyncMock = vi.fn()
const getMirrorProvidersMock = vi.fn()
const getMirrorStatusMock = vi.fn()

vi.mock('../../../services/api', () => ({
  default: {
    listMirrors: (...args: unknown[]) => listMirrorsMock(...args),
    createMirror: (...args: unknown[]) => createMirrorMock(...args),
    updateMirror: (...args: unknown[]) => updateMirrorMock(...args),
    deleteMirror: (...args: unknown[]) => deleteMirrorMock(...args),
    triggerMirrorSync: (...args: unknown[]) => triggerMirrorSyncMock(...args),
    getMirrorProviders: (...args: unknown[]) => getMirrorProvidersMock(...args),
    getMirrorStatus: (...args: unknown[]) => getMirrorStatusMock(...args),
  },
}))

import MirrorsPage from '../MirrorsPage'

function renderWithProviders(
  ui: React.ReactElement,
  { initialEntries = ['/admin/mirrors'] }: { initialEntries?: string[] } = {},
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

const baseMirror = {
  id: 'mirror-1',
  name: 'Upstream Public',
  description: 'Main upstream mirror for hashicorp providers',
  upstream_registry_url: 'https://registry.terraform.io',
  namespace_filter: '["hashicorp"]',
  provider_filter: '["aws","google"]',
  version_filter: '>=3.0.0',
  platform_filter: '["linux/amd64","darwin/arm64"]',
  enabled: true,
  sync_interval_hours: 12,
  last_sync_at: '2025-07-01T08:00:00Z',
  last_sync_status: 'success' as const,
  last_sync_error: undefined,
  created_at: '2025-06-01T00:00:00Z',
  updated_at: '2025-07-01T08:00:00Z',
}

const failedMirror = {
  id: 'mirror-2',
  name: 'Datadog Mirror',
  upstream_registry_url: 'https://registry.terraform.io',
  enabled: false,
  sync_interval_hours: 24,
  last_sync_at: '2025-07-01T10:00:00Z',
  last_sync_status: 'failed' as const,
  last_sync_error: 'Connection timed out',
  created_at: '2025-06-15T00:00:00Z',
  updated_at: '2025-07-01T10:00:00Z',
}

const inProgressMirror = {
  id: 'mirror-3',
  name: 'Syncing Mirror',
  upstream_registry_url: 'https://registry.terraform.io',
  enabled: true,
  sync_interval_hours: 6,
  last_sync_status: 'in_progress' as const,
  created_at: '2025-06-20T00:00:00Z',
  updated_at: '2025-07-02T00:00:00Z',
}

const neverSyncedMirror = {
  id: 'mirror-4',
  name: 'New Mirror',
  upstream_registry_url: 'https://registry.terraform.io',
  enabled: true,
  sync_interval_hours: 24,
  created_at: '2025-07-02T00:00:00Z',
  updated_at: '2025-07-02T00:00:00Z',
}

describe('MirrorsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner while fetching', () => {
    listMirrorsMock.mockReturnValue(new Promise(() => { }))
    renderWithProviders(<MirrorsPage />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders heading and subheading after load', async () => {
    listMirrorsMock.mockResolvedValue([])
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Mirroring — Provider Config')).toBeInTheDocument()
    })
    expect(
      screen.getByText('Configure upstream registry mirroring for providers'),
    ).toBeInTheDocument()
  })

  it('renders mirror cards with name and upstream URL', async () => {
    listMirrorsMock.mockResolvedValue([baseMirror, failedMirror])
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Upstream Public')).toBeInTheDocument()
    })
    expect(screen.getByText('Datadog Mirror')).toBeInTheDocument()
    expect(
      screen.getAllByText('https://registry.terraform.io').length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('shows Enabled/Disabled chips on mirror cards', async () => {
    listMirrorsMock.mockResolvedValue([baseMirror, failedMirror])
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Enabled')).toBeInTheDocument()
    })
    expect(screen.getByText('Disabled')).toBeInTheDocument()
  })

  it('shows correct status chips for sync states', async () => {
    listMirrorsMock.mockResolvedValue([
      baseMirror,
      failedMirror,
      inProgressMirror,
      neverSyncedMirror,
    ])
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Success')).toBeInTheDocument()
    })
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('Syncing...')).toBeInTheDocument()
    expect(screen.getByText('Never synced')).toBeInTheDocument()
  })

  it('shows description and filter chips on mirror card', async () => {
    listMirrorsMock.mockResolvedValue([baseMirror])
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(
        screen.getByText('Main upstream mirror for hashicorp providers'),
      ).toBeInTheDocument()
    })
    expect(screen.getByText('Namespaces: hashicorp')).toBeInTheDocument()
    expect(screen.getByText('Providers: aws, google')).toBeInTheDocument()
    expect(screen.getByText('Versions: >=3.0.0')).toBeInTheDocument()
    expect(
      screen.getByText('Platforms: linux/amd64, darwin/arm64'),
    ).toBeInTheDocument()
  })

  it('shows sync interval and last sync date', async () => {
    listMirrorsMock.mockResolvedValue([baseMirror])
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText(/Sync interval: 12 hours/)).toBeInTheDocument()
    })
    expect(screen.getByText(/Last sync:/)).toBeInTheDocument()
  })

  it('shows last sync error alert on failed mirror card', async () => {
    listMirrorsMock.mockResolvedValue([failedMirror])
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Connection timed out')).toBeInTheDocument()
    })
  })

  it('shows empty state when no mirrors exist', async () => {
    listMirrorsMock.mockResolvedValue([])
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(
        screen.getByText(
          'No mirror configurations found. Add one to start mirroring providers from upstream registries.',
        ),
      ).toBeInTheDocument()
    })
  })

  it('shows Refresh and Add Mirror buttons', async () => {
    listMirrorsMock.mockResolvedValue([])
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument()
    })
    expect(screen.getByText('Add Mirror')).toBeInTheDocument()
  })

  it('opens create dialog when Add Mirror is clicked', async () => {
    listMirrorsMock.mockResolvedValue([])
    const user = userEvent.setup()
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Add Mirror')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Add Mirror'))
    expect(screen.getByText('Add Provider Mirror')).toBeInTheDocument()
    expect(screen.getByLabelText('Name *')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
    expect(screen.getByLabelText('Upstream Registry URL *')).toBeInTheDocument()
    expect(screen.getByLabelText('Namespace Filter')).toBeInTheDocument()
    expect(screen.getByLabelText('Provider Filter')).toBeInTheDocument()
    expect(screen.getByLabelText('Version Filter')).toBeInTheDocument()
    expect(screen.getByLabelText('Platform Filter')).toBeInTheDocument()
    expect(screen.getByLabelText('Sync Interval (hours)')).toBeInTheDocument()
    expect(screen.getByText('Create')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('submits create form and shows success', async () => {
    listMirrorsMock.mockResolvedValue([])
    createMirrorMock.mockResolvedValue({ id: 'new-mirror' })
    const user = userEvent.setup()
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Add Mirror')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Add Mirror'))

    const nameInput = screen.getByLabelText('Name *')
    await user.clear(nameInput)
    await user.type(nameInput, 'My New Mirror')

    await user.click(screen.getByText('Create'))
    await waitFor(() => {
      expect(createMirrorMock).toHaveBeenCalledTimes(1)
    })
    const callArg = createMirrorMock.mock.calls[0][0]
    expect(callArg.name).toBe('My New Mirror')
    expect(callArg.upstream_registry_url).toBe('https://registry.terraform.io')
  })

  it('opens edit dialog with pre-populated form data', async () => {
    listMirrorsMock.mockResolvedValue([baseMirror])
    const user = userEvent.setup()
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Upstream Public')).toBeInTheDocument()
    })

    await user.click(screen.getByLabelText('Edit mirror'))
    expect(screen.getByText('Edit Mirror')).toBeInTheDocument()
    expect(screen.getByLabelText('Name *')).toHaveValue('Upstream Public')
    expect(screen.getByLabelText('Upstream Registry URL *')).toHaveValue(
      'https://registry.terraform.io',
    )
    expect(screen.getByLabelText('Namespace Filter')).toHaveValue('hashicorp')
    expect(screen.getByLabelText('Provider Filter')).toHaveValue('aws, google')
    expect(screen.getByLabelText('Version Filter')).toHaveValue('>=3.0.0')
    expect(screen.getByLabelText('Platform Filter')).toHaveValue(
      'linux/amd64, darwin/arm64',
    )
    expect(screen.getByText('Update')).toBeInTheDocument()
  })

  it('submits edit form and calls updateMirror', async () => {
    listMirrorsMock.mockResolvedValue([baseMirror])
    updateMirrorMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Upstream Public')).toBeInTheDocument()
    })

    await user.click(screen.getByLabelText('Edit mirror'))
    await user.click(screen.getByText('Update'))
    await waitFor(() => {
      expect(updateMirrorMock).toHaveBeenCalledTimes(1)
    })
    expect(updateMirrorMock.mock.calls[0][0]).toBe('mirror-1')
  })

  it('opens delete confirmation and deletes mirror', async () => {
    listMirrorsMock.mockResolvedValue([baseMirror])
    deleteMirrorMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Upstream Public')).toBeInTheDocument()
    })

    await user.click(screen.getByLabelText('Delete mirror'))
    expect(screen.getByText('Confirm Delete')).toBeInTheDocument()
    expect(
      screen.getByText(/Are you sure you want to delete the mirror "Upstream Public"/),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(deleteMirrorMock).toHaveBeenCalledWith('mirror-1')
    })
  })

  it('triggers sync and shows success message', async () => {
    listMirrorsMock.mockResolvedValue([baseMirror])
    triggerMirrorSyncMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Upstream Public')).toBeInTheDocument()
    })

    await user.click(screen.getByLabelText('Sync mirror'))
    await waitFor(() => {
      expect(triggerMirrorSyncMock).toHaveBeenCalledWith('mirror-1')
    })
    await waitFor(() => {
      expect(
        screen.getByText('Sync triggered for "Upstream Public"'),
      ).toBeInTheDocument()
    })
  })

  it('disables sync button when sync is in progress', async () => {
    listMirrorsMock.mockResolvedValue([inProgressMirror])
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Syncing Mirror')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Sync mirror')).toBeDisabled()
  })

  it('opens View Details dialog and shows providers', async () => {
    listMirrorsMock.mockResolvedValue([baseMirror])
    getMirrorProvidersMock.mockResolvedValue([
      {
        id: 'prov-1',
        mirror_config_id: 'mirror-1',
        provider_id: 'p1',
        upstream_namespace: 'hashicorp',
        upstream_type: 'aws',
        last_synced_at: '2025-07-01T08:00:00Z',
        last_sync_version: '5.10.0',
        sync_enabled: true,
        created_at: '2025-06-01T00:00:00Z',
        versions: [],
      },
    ])
    const user = userEvent.setup()
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Upstream Public')).toBeInTheDocument()
    })

    await user.click(screen.getByText('View Details'))
    await waitFor(() => {
      expect(
        screen.getByText('Providers — Upstream Public'),
      ).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText('hashicorp')).toBeInTheDocument()
    })
    expect(screen.getByText('aws')).toBeInTheDocument()
    expect(screen.getByText('5.10.0')).toBeInTheDocument()
  })

  it('shows empty info alert in providers dialog when no providers synced', async () => {
    listMirrorsMock.mockResolvedValue([baseMirror])
    getMirrorProvidersMock.mockResolvedValue([])
    const user = userEvent.setup()
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Upstream Public')).toBeInTheDocument()
    })

    await user.click(screen.getByText('View Details'))
    await waitFor(() => {
      expect(
        screen.getByText('No providers have been synced yet.'),
      ).toBeInTheDocument()
    })
  })

  it('opens sync history dialog and shows history entries', async () => {
    listMirrorsMock.mockResolvedValue([baseMirror])
    getMirrorStatusMock.mockResolvedValue({
      mirror_config: baseMirror,
      recent_syncs: [
        {
          id: 'sync-1',
          mirror_config_id: 'mirror-1',
          started_at: '2025-07-01T07:00:00Z',
          completed_at: '2025-07-01T08:00:00Z',
          status: 'success',
          providers_synced: 5,
          providers_failed: 0,
        },
        {
          id: 'sync-2',
          mirror_config_id: 'mirror-1',
          started_at: '2025-06-30T07:00:00Z',
          completed_at: '2025-06-30T07:30:00Z',
          status: 'failed',
          providers_synced: 2,
          providers_failed: 3,
          error_message: 'Rate limited by upstream',
        },
      ],
    })
    const user = userEvent.setup()
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Upstream Public')).toBeInTheDocument()
    })

    await user.click(screen.getByLabelText('View sync history'))
    await waitFor(() => {
      expect(
        screen.getByText('Sync History — Upstream Public'),
      ).toBeInTheDocument()
    })

    // Wait for history entries to appear
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument()
    })
    // The failed row has providers_failed=3
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows empty history message when no syncs exist', async () => {
    listMirrorsMock.mockResolvedValue([baseMirror])
    getMirrorStatusMock.mockResolvedValue({
      mirror_config: baseMirror,
      recent_syncs: [],
    })
    const user = userEvent.setup()
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Upstream Public')).toBeInTheDocument()
    })

    await user.click(screen.getByLabelText('View sync history'))
    await waitFor(() => {
      expect(
        screen.getByText('No sync history available.'),
      ).toBeInTheDocument()
    })
  })

  it('closes create dialog when Cancel is clicked', async () => {
    listMirrorsMock.mockResolvedValue([])
    const user = userEvent.setup()
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Add Mirror')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Add Mirror'))
    expect(screen.getByText('Add Provider Mirror')).toBeInTheDocument()

    await user.click(screen.getByText('Cancel'))
    await waitFor(() => {
      expect(screen.queryByText('Add Provider Mirror')).not.toBeInTheDocument()
    })
  })

  it('auto-opens create dialog when ?action=add is in URL', async () => {
    listMirrorsMock.mockResolvedValue([])
    renderWithProviders(<MirrorsPage />, {
      initialEntries: ['/admin/mirrors?action=add'],
    })
    await waitFor(() => {
      expect(screen.getByText('Add Provider Mirror')).toBeInTheDocument()
    })
  })

  it('shows error alert when create mutation fails', async () => {
    listMirrorsMock.mockResolvedValue([])
    createMirrorMock.mockRejectedValue(new Error('Server error'))
    const user = userEvent.setup()
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Add Mirror')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Add Mirror'))

    const nameInput = screen.getByLabelText('Name *')
    await user.type(nameInput, 'Bad Mirror')

    await user.click(screen.getByText('Create'))
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
  })

  it('shows error alert when trigger sync fails', async () => {
    listMirrorsMock.mockResolvedValue([baseMirror])
    triggerMirrorSyncMock.mockRejectedValue(new Error('Sync unavailable'))
    const user = userEvent.setup()
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Upstream Public')).toBeInTheDocument()
    })
    await user.click(screen.getByLabelText('Sync mirror'))
    await waitFor(() => {
      expect(screen.getByText('Sync unavailable')).toBeInTheDocument()
    })
  })

  it('shows error alert when update mutation fails', async () => {
    listMirrorsMock.mockResolvedValue([baseMirror])
    updateMirrorMock.mockRejectedValue(new Error('Update failed'))
    const user = userEvent.setup()
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Upstream Public')).toBeInTheDocument()
    })
    await user.click(screen.getByLabelText('Edit mirror'))
    await user.click(screen.getByText('Update'))
    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeInTheDocument()
    })
  })

  it('shows error alert when delete mutation fails', async () => {
    listMirrorsMock.mockResolvedValue([baseMirror])
    deleteMirrorMock.mockRejectedValue(new Error('Delete failed'))
    const user = userEvent.setup()
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Upstream Public')).toBeInTheDocument()
    })
    await user.click(screen.getByLabelText('Delete mirror'))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(screen.getByText('Delete failed')).toBeInTheDocument()
    })
  })

  it('shows pagination when more than 10 mirrors exist', async () => {
    const manyMirrors = Array.from({ length: 12 }, (_, i) => ({
      id: `m-${i}`,
      name: `Mirror ${i}`,
      upstream_registry_url: 'https://registry.terraform.io',
      enabled: true,
      sync_interval_hours: 24,
      created_at: '2025-07-01T00:00:00Z',
      updated_at: '2025-07-01T00:00:00Z',
    }))
    listMirrorsMock.mockResolvedValue(manyMirrors)
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Mirror 0')).toBeInTheDocument()
    })
    // First page shows 10 items; mirrors 10 and 11 are on page 2
    expect(screen.queryByText('Mirror 10')).not.toBeInTheDocument()
    // Pagination controls should be present
    expect(screen.getByText('1–10 of 12')).toBeInTheDocument()
  })

  it('expands provider row to show version sub-table in providers dialog', async () => {
    listMirrorsMock.mockResolvedValue([baseMirror])
    getMirrorProvidersMock.mockResolvedValue([
      {
        id: 'prov-1',
        mirror_config_id: 'mirror-1',
        provider_id: 'p1',
        upstream_namespace: 'hashicorp',
        upstream_type: 'aws',
        last_synced_at: '2025-07-01T08:00:00Z',
        last_sync_version: '5.10.0',
        sync_enabled: true,
        created_at: '2025-06-01T00:00:00Z',
        versions: [
          {
            id: 'v1',
            mirrored_provider_id: 'prov-1',
            provider_version_id: 'pv1',
            upstream_version: '5.10.0',
            synced_at: '2025-07-01T08:00:00Z',
            shasum_verified: true,
            gpg_verified: false,
            platforms: [
              {
                id: 'plat-1',
                provider_version_id: 'pv1',
                os: 'linux',
                arch: 'amd64',
                filename: 'terraform-provider-aws_5.10.0_linux_amd64.zip',
                shasum: 'abc123def456abc123def456abc123de',
              },
            ],
          },
        ],
      },
    ])
    const user = userEvent.setup()
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Upstream Public')).toBeInTheDocument()
    })

    await user.click(screen.getByText('View Details'))
    await waitFor(() => {
      expect(screen.getByText('hashicorp')).toBeInTheDocument()
    })

    // Expand the provider row to show versions
    const toggleVersionsBtn = screen.getByLabelText('Toggle versions')
    await user.click(toggleVersionsBtn)

    // The version row shows the upstream_version in a monospace caption
    await waitFor(() => {
      // Both the card-level "5.10.0" and the version row render it
      expect(screen.getAllByText('5.10.0').length).toBeGreaterThanOrEqual(2)
    })

    // Expand the version row to show platforms
    const togglePlatformsBtn = screen.getByLabelText('Toggle platforms')
    await user.click(togglePlatformsBtn)
    await waitFor(() => {
      expect(screen.getByText('linux')).toBeInTheDocument()
    })
    expect(screen.getByText('amd64')).toBeInTheDocument()
    expect(
      screen.getByText('terraform-provider-aws_5.10.0_linux_amd64.zip'),
    ).toBeInTheDocument()
  })

  it('shows default status chip for unknown sync status', async () => {
    const unknownStatusMirror = {
      id: 'mirror-unknown',
      name: 'Unknown Status Mirror',
      upstream_registry_url: 'https://registry.terraform.io',
      enabled: true,
      sync_interval_hours: 24,
      last_sync_status: 'partial' as 'success',
      created_at: '2025-07-02T00:00:00Z',
      updated_at: '2025-07-02T00:00:00Z',
    }
    listMirrorsMock.mockResolvedValue([unknownStatusMirror])
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Unknown Status Mirror')).toBeInTheDocument()
    })
    // The default case renders the raw status text
    expect(screen.getByText('partial')).toBeInTheDocument()
  })

  it('shows "Never" for last sync when mirror has never been synced', async () => {
    listMirrorsMock.mockResolvedValue([neverSyncedMirror])
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText(/Last sync: Never/)).toBeInTheDocument()
    })
  })

  it('handles getMirrorProviders failure gracefully', async () => {
    listMirrorsMock.mockResolvedValue([baseMirror])
    getMirrorProvidersMock.mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Upstream Public')).toBeInTheDocument()
    })
    await user.click(screen.getByText('View Details'))
    // When providers fetch fails, it shows "No providers have been synced yet." (empty fallback)
    await waitFor(() => {
      expect(
        screen.getByText('No providers have been synced yet.'),
      ).toBeInTheDocument()
    })
  })

  it('handles getMirrorStatus failure gracefully in history dialog', async () => {
    listMirrorsMock.mockResolvedValue([baseMirror])
    getMirrorStatusMock.mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Upstream Public')).toBeInTheDocument()
    })
    await user.click(screen.getByLabelText('View sync history'))
    // When status fetch fails, it falls back to empty history
    await waitFor(() => {
      expect(
        screen.getByText('No sync history available.'),
      ).toBeInTheDocument()
    })
  })

  it('closes history dialog when Close button is clicked', async () => {
    listMirrorsMock.mockResolvedValue([baseMirror])
    getMirrorStatusMock.mockResolvedValue({
      mirror_config: baseMirror,
      recent_syncs: [],
    })
    const user = userEvent.setup()
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Upstream Public')).toBeInTheDocument()
    })
    await user.click(screen.getByLabelText('View sync history'))
    await waitFor(() => {
      expect(screen.getByText('Sync History — Upstream Public')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Close'))
    await waitFor(() => {
      expect(screen.queryByText('Sync History — Upstream Public')).not.toBeInTheDocument()
    })
  })

  it('closes providers dialog when Close button is clicked', async () => {
    listMirrorsMock.mockResolvedValue([baseMirror])
    getMirrorProvidersMock.mockResolvedValue([])
    const user = userEvent.setup()
    renderWithProviders(<MirrorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Upstream Public')).toBeInTheDocument()
    })
    await user.click(screen.getByText('View Details'))
    await waitFor(() => {
      expect(screen.getByText('Providers — Upstream Public')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Close'))
    await waitFor(() => {
      expect(screen.queryByText('Providers — Upstream Public')).not.toBeInTheDocument()
    })
  })
})
