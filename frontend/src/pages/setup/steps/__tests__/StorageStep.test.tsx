import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCtx = {
  storageForm: {
    backend_type: 'local' as string,
    local_base_path: '/data',
    local_serve_directly: true,
  } as Record<string, unknown>,
  setStorageForm: vi.fn(),
  changeStorageBackend: vi.fn(),
  storageTesting: false,
  storageTestResult: null as { success: boolean; message: string } | null,
  storageSaving: false,
  storageSaved: false,
  testStorage: vi.fn(),
  saveStorage: vi.fn(),
  goToStep: vi.fn(),
}

vi.mock('../../../../contexts/SetupWizardContext', () => ({
  useSetupWizard: () => mockCtx,
}))

import StorageStep from '../StorageStep'

beforeEach(() => {
  vi.clearAllMocks()
  mockCtx.storageForm = {
    backend_type: 'local',
    local_base_path: '/data',
    local_serve_directly: true,
  }
  mockCtx.storageTesting = false
  mockCtx.storageTestResult = null
  mockCtx.storageSaving = false
  mockCtx.storageSaved = false
})

describe('StorageStep', () => {
  it('renders heading and backend chips', () => {
    render(<StorageStep />)
    expect(screen.getByText('Storage Backend Configuration')).toBeInTheDocument()
    expect(screen.getByText('Local')).toBeInTheDocument()
    expect(screen.getByText('Azure Blob')).toBeInTheDocument()
    expect(screen.getByText('AWS S3')).toBeInTheDocument()
    expect(screen.getByText('Google Cloud')).toBeInTheDocument()
  })

  it('shows local storage fields by default', () => {
    render(<StorageStep />)
    expect(screen.getByLabelText('Base Path')).toBeInTheDocument()
    expect(screen.getByLabelText(/Serve files directly/)).toBeInTheDocument()
  })

  it('calls changeStorageBackend when chip is clicked', async () => {
    render(<StorageStep />)
    await userEvent.setup().click(screen.getByText('AWS S3'))
    expect(mockCtx.changeStorageBackend).toHaveBeenCalledWith('s3')
  })

  it('shows Azure fields when backend is azure', () => {
    mockCtx.storageForm = { backend_type: 'azure' }
    render(<StorageStep />)
    expect(screen.getByLabelText(/Account Name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Container Name/)).toBeInTheDocument()
  })

  it('shows S3 fields when backend is s3', () => {
    mockCtx.storageForm = { backend_type: 's3', s3_auth_method: 'access_key' }
    render(<StorageStep />)
    expect(screen.getByLabelText(/Region/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Bucket/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Access Key ID/)).toBeInTheDocument()
  })

  it('shows GCS fields when backend is gcs', () => {
    mockCtx.storageForm = { backend_type: 'gcs', gcs_auth_method: 'credentials_file' }
    render(<StorageStep />)
    expect(screen.getByLabelText(/^Bucket/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Project ID/)).toBeInTheDocument()
  })

  it('calls testStorage on Test button click', async () => {
    render(<StorageStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Test Connection/i }))
    expect(mockCtx.testStorage).toHaveBeenCalledOnce()
  })

  it('calls saveStorage on Save button click', async () => {
    render(<StorageStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Save Storage/i }))
    expect(mockCtx.saveStorage).toHaveBeenCalledOnce()
  })

  it('shows test result alert', () => {
    mockCtx.storageTestResult = { success: true, message: 'Storage connection OK' }
    render(<StorageStep />)
    expect(screen.getByText('Storage connection OK')).toBeInTheDocument()
  })

  it('shows Next button when saved', () => {
    mockCtx.storageSaved = true
    render(<StorageStep />)
    expect(screen.getByRole('button', { name: /Next: Security Scanning/i })).toBeInTheDocument()
  })

  it('navigates back on Back click', async () => {
    render(<StorageStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Back/i }))
    expect(mockCtx.goToStep).toHaveBeenCalledWith(1)
  })

  it('updates local_base_path on Base Path change', () => {
    render(<StorageStep />)
    fireEvent.change(screen.getByLabelText('Base Path'), { target: { value: '/new/path' } })
    expect(mockCtx.setStorageForm).toHaveBeenCalledWith(
      expect.objectContaining({ local_base_path: '/new/path' }),
    )
  })

  it('toggles serve-directly switch', () => {
    render(<StorageStep />)
    const sw = document.querySelector('input[type="checkbox"]') as HTMLInputElement
    fireEvent.click(sw)
    expect(mockCtx.setStorageForm).toHaveBeenCalled()
  })

  it('updates Azure fields on change', () => {
    mockCtx.storageForm = { backend_type: 'azure' }
    render(<StorageStep />)
    fireEvent.change(screen.getByLabelText(/Account Name/), { target: { value: 'acct' } })
    fireEvent.change(screen.getByLabelText(/Account Key/), { target: { value: 'key' } })
    fireEvent.change(screen.getByLabelText(/Container Name/), { target: { value: 'cont' } })
    fireEvent.change(screen.getByLabelText(/CDN URL/), {
      target: { value: 'https://cdn.example.com' },
    })
    expect(mockCtx.setStorageForm).toHaveBeenCalledTimes(4)
  })

  it('updates S3 fields on change and shows assume_role inputs', () => {
    mockCtx.storageForm = { backend_type: 's3', s3_auth_method: 'assume_role' }
    render(<StorageStep />)
    expect(screen.getByLabelText(/Role ARN/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Role Session Name/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Role ARN/), { target: { value: 'arn:...:role/x' } })
    fireEvent.change(screen.getByLabelText(/Role Session Name/), { target: { value: 'sess' } })
    expect(mockCtx.setStorageForm).toHaveBeenCalledTimes(2)
  })

  it('updates S3 fields on change for access_key method', () => {
    mockCtx.storageForm = { backend_type: 's3', s3_auth_method: 'access_key' }
    render(<StorageStep />)
    fireEvent.change(screen.getByLabelText(/Region/), { target: { value: 'us-west-2' } })
    fireEvent.change(screen.getByLabelText(/^Bucket/), { target: { value: 'my-bucket' } })
    fireEvent.change(screen.getByLabelText(/Endpoint/), {
      target: { value: 'https://s3.example.com' },
    })
    fireEvent.change(screen.getByLabelText(/Access Key ID/), { target: { value: 'AKIA...' } })
    fireEvent.change(screen.getByLabelText(/Secret Access Key/), { target: { value: 'secret' } })
    expect(mockCtx.setStorageForm).toHaveBeenCalledTimes(5)
  })

  it('updates GCS fields on change and shows credentials file input', () => {
    mockCtx.storageForm = { backend_type: 'gcs', gcs_auth_method: 'credentials_file' }
    render(<StorageStep />)
    expect(screen.getByLabelText(/Credentials File Path/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^Bucket/), { target: { value: 'gcs-b' } })
    fireEvent.change(screen.getByLabelText(/Project ID/), { target: { value: 'proj-1' } })
    fireEvent.change(screen.getByLabelText(/Credentials File Path/), {
      target: { value: '/path/sa.json' },
    })
    expect(mockCtx.setStorageForm).toHaveBeenCalledTimes(3)
  })

  it('shows credentials JSON textarea for credentials_json gcs method', () => {
    mockCtx.storageForm = { backend_type: 'gcs', gcs_auth_method: 'credentials_json' }
    render(<StorageStep />)
    expect(screen.getByLabelText(/Credentials JSON/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Credentials JSON/), { target: { value: '{"a":1}' } })
    expect(mockCtx.setStorageForm).toHaveBeenCalled()
  })

  it('shows error result alert when test result is failure', () => {
    mockCtx.storageTestResult = { success: false, message: 'connection failed' }
    render(<StorageStep />)
    expect(screen.getByText('connection failed')).toBeInTheDocument()
  })

  it('disables Test Connection button while testing', () => {
    mockCtx.storageTesting = true
    render(<StorageStep />)
    expect(screen.getByRole('button', { name: /Test Connection/i })).toBeDisabled()
  })

  it('disables Save button while saving', () => {
    mockCtx.storageSaving = true
    render(<StorageStep />)
    expect(screen.getByRole('button', { name: /Save Storage/i })).toBeDisabled()
  })

  it('navigates to next step when Next is clicked', async () => {
    mockCtx.storageSaved = true
    render(<StorageStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Next: Security Scanning/i }))
    expect(mockCtx.goToStep).toHaveBeenCalledWith(3)
  })
})
