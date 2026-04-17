import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCtx = {
  storageForm: { backend_type: 'local' as string, local_base_path: '/data', local_serve_directly: true } as Record<string, unknown>,
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
  mockCtx.storageForm = { backend_type: 'local', local_base_path: '/data', local_serve_directly: true }
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
})
