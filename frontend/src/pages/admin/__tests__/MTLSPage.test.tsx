import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { MTLSConfigResponse } from '../../../types'

const getMTLSConfigMock = vi.fn()

vi.mock('../../../services/api', () => ({
  default: {
    getMTLSConfig: (...args: unknown[]) => getMTLSConfigMock(...args),
  },
}))

import MTLSPage from '../MTLSPage'

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const enabledConfig: MTLSConfigResponse = {
  enabled: true,
  client_ca_file: '/etc/ssl/client-ca.pem',
  mappings: [
    { subject: 'CN=deploy-bot,O=Acme', scopes: ['modules:write', 'providers:write'] },
    { subject: 'CN=reader,O=Acme', scopes: ['modules:read'] },
  ],
}

const disabledConfig: MTLSConfigResponse = {
  enabled: false,
  client_ca_file: '',
  mappings: [],
}

describe('MTLSPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner initially', () => {
    getMTLSConfigMock.mockReturnValue(new Promise(() => { }))
    renderWithProviders(<MTLSPage />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows error alert when API fails', async () => {
    getMTLSConfigMock.mockRejectedValue(new Error('Network error'))
    renderWithProviders(<MTLSPage />)
    await waitFor(() => {
      expect(screen.getByText(/Failed to load mTLS configuration/)).toBeInTheDocument()
    })
  })

  it('renders enabled config with mappings table', async () => {
    getMTLSConfigMock.mockResolvedValue(enabledConfig)
    renderWithProviders(<MTLSPage />)
    await waitFor(() => {
      expect(screen.getByText('Enabled')).toBeInTheDocument()
    })
    expect(screen.getByText('/etc/ssl/client-ca.pem')).toBeInTheDocument()
    expect(screen.getByText('CN=deploy-bot,O=Acme')).toBeInTheDocument()
    expect(screen.getByText('modules:write')).toBeInTheDocument()
    expect(screen.getByText('providers:write')).toBeInTheDocument()
    expect(screen.getByText('CN=reader,O=Acme')).toBeInTheDocument()
    expect(screen.getByText('modules:read')).toBeInTheDocument()
  })

  it('renders disabled config with empty state', async () => {
    getMTLSConfigMock.mockResolvedValue(disabledConfig)
    renderWithProviders(<MTLSPage />)
    await waitFor(() => {
      expect(screen.getByText('Disabled')).toBeInTheDocument()
    })
    expect(screen.getByText(/No mTLS certificate mappings configured/)).toBeInTheDocument()
  })

  it('renders heading and description', async () => {
    getMTLSConfigMock.mockResolvedValue(enabledConfig)
    renderWithProviders(<MTLSPage />)
    expect(screen.getByText('mTLS Client Certificate Mappings')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/Mutual TLS certificate-subject/)).toBeInTheDocument()
    })
  })
})
