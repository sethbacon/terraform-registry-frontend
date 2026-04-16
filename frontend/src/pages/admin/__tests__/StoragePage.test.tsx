import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { StorageConfigResponse } from '../../../types'

const getSetupStatusMock = vi.fn()
const listStorageConfigsMock = vi.fn()
const listStorageMigrationsMock = vi.fn()
const testStorageConfigMock = vi.fn()
const createStorageConfigMock = vi.fn()
const activateStorageConfigMock = vi.fn()
const deleteStorageConfigMock = vi.fn()

vi.mock('../../../services/api', () => ({
  default: {
    getSetupStatus: (...args: unknown[]) => getSetupStatusMock(...args),
    listStorageConfigs: (...args: unknown[]) => listStorageConfigsMock(...args),
    listStorageMigrations: (...args: unknown[]) => listStorageMigrationsMock(...args),
    testStorageConfig: (...args: unknown[]) => testStorageConfigMock(...args),
    createStorageConfig: (...args: unknown[]) => createStorageConfigMock(...args),
    activateStorageConfig: (...args: unknown[]) => activateStorageConfigMock(...args),
    deleteStorageConfig: (...args: unknown[]) => deleteStorageConfigMock(...args),
  },
}))

vi.mock('../../../components/StorageMigrationWizard', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="migration-wizard">Migration Wizard</div> : null,
}))

import StoragePage from '../StoragePage'

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const fakeLocalConfig = {
  id: 'cfg-1',
  backend_type: 'local' as const,
  is_active: true,
  local_base_path: './data/storage',
  local_serve_directly: true,
  azure_account_key_set: false,
  s3_access_key_id_set: false,
  s3_secret_access_key_set: false,
  gcs_credentials_json_set: false,
  created_at: '2025-06-01T12:00:00Z',
  updated_at: '2025-06-01T12:00:00Z',
}

const fakeS3Config = {
  id: 'cfg-2',
  backend_type: 's3' as const,
  is_active: false,
  s3_bucket: 'my-bucket',
  s3_region: 'us-east-1',
  s3_auth_method: 'default',
  azure_account_key_set: false,
  s3_access_key_id_set: false,
  s3_secret_access_key_set: false,
  gcs_credentials_json_set: false,
  created_at: '2025-06-02T10:00:00Z',
  updated_at: '2025-06-02T10:00:00Z',
}

const fakeAzureConfig = {
  id: 'cfg-3',
  backend_type: 'azure' as const,
  is_active: false,
  azure_account_name: 'myaccount',
  azure_container_name: 'mycontainer',
  azure_account_key_set: true,
  s3_access_key_id_set: false,
  s3_secret_access_key_set: false,
  gcs_credentials_json_set: false,
  created_at: '2025-06-03T10:00:00Z',
  updated_at: '2025-06-03T10:00:00Z',
}

const fakeGcsConfig = {
  id: 'cfg-4',
  backend_type: 'gcs' as const,
  is_active: false,
  gcs_bucket: 'gcs-bucket',
  gcs_auth_method: 'default',
  azure_account_key_set: false,
  s3_access_key_id_set: false,
  s3_secret_access_key_set: false,
  gcs_credentials_json_set: false,
  created_at: '2025-06-04T10:00:00Z',
  updated_at: '2025-06-04T10:00:00Z',
}

const fakeMigration = {
  id: 'mig-1',
  source_config_id: 'cfg-1',
  target_config_id: 'cfg-2',
  status: 'completed' as const,
  total_artifacts: 10,
  migrated_artifacts: 10,
  failed_artifacts: 0,
  started_at: '2025-06-05T08:00:00Z',
  completed_at: '2025-06-05T08:30:00Z',
  created_at: '2025-06-05T08:00:00Z',
}

/** Helper: mock API for setup-required state (shows wizard) */
function mockSetupRequired() {
  getSetupStatusMock.mockResolvedValue({ setup_required: true, storage_configured: false })
  listStorageConfigsMock.mockResolvedValue([])
  listStorageMigrationsMock.mockResolvedValue([])
}

/** Helper: mock API for existing configs state */
function mockExistingConfigs(
  configs: StorageConfigResponse[] = [fakeLocalConfig, fakeS3Config],
  migrations: typeof fakeMigration[] = [],
) {
  getSetupStatusMock.mockResolvedValue({ setup_required: false, storage_configured: true })
  listStorageConfigsMock.mockResolvedValue(configs)
  listStorageMigrationsMock.mockResolvedValue(migrations)
}

describe('StoragePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---- Loading state ----

  it('shows loading spinner while fetching', () => {
    getSetupStatusMock.mockReturnValue(new Promise(() => { }))
    renderWithProviders(<StoragePage />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  // ---- Setup Wizard view ----

  it('renders setup wizard heading when setup is required', async () => {
    mockSetupRequired()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Storage Configuration')).toBeInTheDocument()
    })
    expect(
      screen.getByText(/Configure where the registry will store module and provider files/)
    ).toBeInTheDocument()
  })

  it('shows stepper with three steps in setup wizard', async () => {
    mockSetupRequired()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Select Backend')).toBeInTheDocument()
    })
    expect(screen.getByText('Configure Settings')).toBeInTheDocument()
    expect(screen.getByText('Review & Save')).toBeInTheDocument()
  })

  it('renders all four backend selection cards', async () => {
    mockSetupRequired()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Local File System')).toBeInTheDocument()
    })
    expect(screen.getByText('Azure Blob Storage')).toBeInTheDocument()
    expect(screen.getByText('Amazon S3 / S3-Compatible')).toBeInTheDocument()
    expect(screen.getByText('Google Cloud Storage')).toBeInTheDocument()
  })

  it('navigates to step 2 and shows local settings form by default', async () => {
    mockSetupRequired()
    const user = userEvent.setup()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Next')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Next'))
    expect(screen.getByLabelText(/Base Path/)).toBeInTheDocument()
    expect(
      screen.getByText(/Serve files directly/)
    ).toBeInTheDocument()
  })

  it('shows Azure settings when Azure backend is selected', async () => {
    mockSetupRequired()
    const user = userEvent.setup()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Azure Blob Storage')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Azure Blob Storage'))
    await user.click(screen.getByText('Next'))
    expect(screen.getByLabelText(/Account Name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Account Key/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Container Name/)).toBeInTheDocument()
  })

  it('shows S3 settings when S3 backend is selected', async () => {
    mockSetupRequired()
    const user = userEvent.setup()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Amazon S3 / S3-Compatible')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Amazon S3 / S3-Compatible'))
    await user.click(screen.getByText('Next'))
    expect(screen.getByLabelText(/Bucket/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Region/)).toBeInTheDocument()
    expect(screen.getAllByText('Authentication Method').length).toBeGreaterThanOrEqual(1)
  })

  it('shows GCS settings when GCS backend is selected', async () => {
    mockSetupRequired()
    const user = userEvent.setup()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Google Cloud Storage')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Google Cloud Storage'))
    await user.click(screen.getByText('Next'))
    expect(screen.getByLabelText(/Bucket/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Project ID/)).toBeInTheDocument()
  })

  it('navigates to review step and shows configuration summary', async () => {
    mockSetupRequired()
    const user = userEvent.setup()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Next')).toBeInTheDocument()
    })
    // Step 0 -> Step 1
    await user.click(screen.getByText('Next'))
    // Step 1 -> Step 2 (review)
    await user.click(screen.getByText('Next'))
    expect(screen.getByText('Configuration Summary')).toBeInTheDocument()
    expect(screen.getByText('Local File System')).toBeInTheDocument()
    expect(screen.getByText('Test Configuration')).toBeInTheDocument()
    expect(screen.getByText('Save Configuration')).toBeInTheDocument()
  })

  it('can go back from review to settings step', async () => {
    mockSetupRequired()
    const user = userEvent.setup()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Next')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Next'))
    await user.click(screen.getByText('Next'))
    expect(screen.getByText('Configuration Summary')).toBeInTheDocument()
    await user.click(screen.getByText('Back'))
    expect(screen.getByLabelText(/Base Path/)).toBeInTheDocument()
  })

  it('calls createStorageConfig when Save Configuration is clicked', async () => {
    mockSetupRequired()
    createStorageConfigMock.mockResolvedValue({
      id: 'new-cfg',
      backend_type: 'local',
      is_active: true,
    })
    const user = userEvent.setup()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Next')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Next'))
    await user.click(screen.getByText('Next'))
    await user.click(screen.getByText('Save Configuration'))
    await waitFor(() => {
      expect(createStorageConfigMock).toHaveBeenCalledTimes(1)
    })
    expect(createStorageConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({ backend_type: 'local' })
    )
  })

  it('shows success alert after saving configuration', async () => {
    mockSetupRequired()
    createStorageConfigMock.mockResolvedValue({ id: 'new-cfg', backend_type: 'local' })
    const user = userEvent.setup()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Next')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Next'))
    await user.click(screen.getByText('Next'))
    await user.click(screen.getByText('Save Configuration'))
    await waitFor(() => {
      expect(screen.getByText('Storage configuration saved successfully!')).toBeInTheDocument()
    })
  })

  it('shows error alert when save fails', async () => {
    mockSetupRequired()
    createStorageConfigMock.mockRejectedValue(new Error('Server error'))
    const user = userEvent.setup()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Next')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Next'))
    await user.click(screen.getByText('Next'))
    await user.click(screen.getByText('Save Configuration'))
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
  })

  it('calls testStorageConfig from review step', async () => {
    mockSetupRequired()
    testStorageConfigMock.mockResolvedValue({ success: true, message: 'OK' })
    const user = userEvent.setup()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Next')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Next'))
    await user.click(screen.getByText('Next'))
    await user.click(screen.getByText('Test Configuration'))
    await waitFor(() => {
      expect(testStorageConfigMock).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(screen.getByText('Storage configuration is valid!')).toBeInTheDocument()
    })
  })

  // ---- Existing Configs view ----

  it('renders existing configs heading when setup is complete', async () => {
    mockExistingConfigs()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Storage Settings')).toBeInTheDocument()
    })
  })

  it('shows info alert about data loss when changing backends', async () => {
    mockExistingConfigs()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText(/Changing storage backends after initial setup may result in data loss/)).toBeInTheDocument()
    })
  })

  it('renders config cards with backend labels and active/inactive chips', async () => {
    mockExistingConfigs()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Local File System')).toBeInTheDocument()
    })
    expect(screen.getByText('Amazon S3 / S3-Compatible')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('shows config-specific details on cards', async () => {
    mockExistingConfigs([fakeLocalConfig, fakeS3Config, fakeAzureConfig, fakeGcsConfig])
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText(/\.\/data\/storage/)).toBeInTheDocument()
    })
    expect(screen.getByText(/my-bucket/)).toBeInTheDocument()
    expect(screen.getByText(/us-east-1/)).toBeInTheDocument()
    expect(screen.getByText(/myaccount/)).toBeInTheDocument()
    expect(screen.getByText(/mycontainer/)).toBeInTheDocument()
    expect(screen.getByText(/gcs-bucket/)).toBeInTheDocument()
  })

  it('shows activate and delete buttons only for inactive configs', async () => {
    mockExistingConfigs()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Local File System')).toBeInTheDocument()
    })
    // Active config should not have activate or delete buttons
    expect(screen.queryByLabelText('Activate Local File System')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Delete Local File System')).not.toBeInTheDocument()
    // Inactive S3 config should have both
    expect(screen.getByLabelText('Activate Amazon S3 / S3-Compatible')).toBeInTheDocument()
    expect(screen.getByLabelText('Delete Amazon S3 / S3-Compatible')).toBeInTheDocument()
  })

  it('calls activateStorageConfig when activate button is clicked', async () => {
    mockExistingConfigs()
    activateStorageConfigMock.mockResolvedValue({ message: 'Activated', config: fakeS3Config })
    const user = userEvent.setup()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByLabelText('Activate Amazon S3 / S3-Compatible')).toBeInTheDocument()
    })
    await user.click(screen.getByLabelText('Activate Amazon S3 / S3-Compatible'))
    await waitFor(() => {
      expect(activateStorageConfigMock).toHaveBeenCalledWith('cfg-2')
    })
  })

  it('calls deleteStorageConfig after confirmation', async () => {
    mockExistingConfigs()
    deleteStorageConfigMock.mockResolvedValue(undefined)
    const confirmMock = vi.fn().mockReturnValue(true)
    vi.stubGlobal('confirm', confirmMock)
    const user = userEvent.setup()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByLabelText('Delete Amazon S3 / S3-Compatible')).toBeInTheDocument()
    })
    await user.click(screen.getByLabelText('Delete Amazon S3 / S3-Compatible'))
    expect(confirmMock).toHaveBeenCalledWith(
      'Are you sure you want to delete this storage configuration?'
    )
    await waitFor(() => {
      expect(deleteStorageConfigMock).toHaveBeenCalledWith('cfg-2')
    })
    vi.unstubAllGlobals()
  })

  it('does not delete when confirmation is cancelled', async () => {
    mockExistingConfigs()
    const confirmMock = vi.fn().mockReturnValue(false)
    vi.stubGlobal('confirm', confirmMock)
    const user = userEvent.setup()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByLabelText('Delete Amazon S3 / S3-Compatible')).toBeInTheDocument()
    })
    await user.click(screen.getByLabelText('Delete Amazon S3 / S3-Compatible'))
    expect(deleteStorageConfigMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('shows test connection button for each config and calls testStorageConfig', async () => {
    mockExistingConfigs()
    testStorageConfigMock.mockResolvedValue({ success: true, message: 'OK' })
    const user = userEvent.setup()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByLabelText('Test Local File System')).toBeInTheDocument()
    })
    await user.click(screen.getByLabelText('Test Local File System'))
    await waitFor(() => {
      expect(testStorageConfigMock).toHaveBeenCalledWith(
        expect.objectContaining({ backend_type: 'local', local_base_path: './data/storage' })
      )
    })
  })

  it('shows Migrate Data button when two or more configs exist', async () => {
    mockExistingConfigs([fakeLocalConfig, fakeS3Config])
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Migrate Data')).toBeInTheDocument()
    })
  })

  it('hides Migrate Data button when fewer than two configs', async () => {
    mockExistingConfigs([fakeLocalConfig])
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Storage Settings')).toBeInTheDocument()
    })
    expect(screen.queryByText('Migrate Data')).not.toBeInTheDocument()
  })

  it('opens migration wizard when Migrate Data is clicked', async () => {
    mockExistingConfigs([fakeLocalConfig, fakeS3Config])
    const user = userEvent.setup()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Migrate Data')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Migrate Data'))
    expect(screen.getByTestId('migration-wizard')).toBeInTheDocument()
  })

  it('renders migration history when migrations exist', async () => {
    mockExistingConfigs([fakeLocalConfig, fakeS3Config], [fakeMigration])
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Migration History')).toBeInTheDocument()
    })
  })

  it('shows migration row details in migration history table', async () => {
    mockExistingConfigs([fakeLocalConfig, fakeS3Config], [fakeMigration])
    const user = userEvent.setup()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Migration History')).toBeInTheDocument()
    })
    // Expand the accordion
    await user.click(screen.getByText('Migration History'))
    // Check table headers
    expect(screen.getByText('Source')).toBeInTheDocument()
    expect(screen.getByText('Target')).toBeInTheDocument()
    // Check migration data
    expect(screen.getByText('completed')).toBeInTheDocument()
    expect(screen.getByText('10 / 10')).toBeInTheDocument()
  })

  it('shows Refresh button in existing configs view', async () => {
    mockExistingConfigs()
    renderWithProviders(<StoragePage />)
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument()
    })
  })
})
