import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

const mockGetReleasesGPGKeys = vi.fn()

vi.mock('../../services/api', () => ({
  default: {
    getReleasesGPGKeys: (...args: unknown[]) => mockGetReleasesGPGKeys(...args),
  },
}))

import ReleasesGPGKeyStatus from '../ReleasesGPGKeyStatus'
import type { ReleasesGPGKeysResponse } from '../../types/releases_gpg_keys'

function renderComponent() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ReleasesGPGKeyStatus />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const okResponse: ReleasesGPGKeysResponse = {
  keys: [
    {
      tool: 'terraform',
      cache: {
        armored_present: true,
        fingerprint: 'C874011F0AB405110D02105534365D9472D7468F',
        fetched_at: '2026-05-01T12:00:00Z',
        source_url: 'https://www.hashicorp.com/.well-known/pgp-key.txt',
        key_expires_at: '2030-03-01T00:00:00Z',
        days_until_expiry: 1400,
      },
      embedded: {
        fingerprint: 'C874011F0AB405110D02105534365D9472D7468F',
        key_expires_at: '2030-03-01T00:00:00Z',
        days_until_expiry: 1400,
      },
      effective_source: 'cache',
      expiry_warning_days: 60,
      status: 'ok',
    },
    {
      tool: 'opentofu',
      cache: null,
      embedded: {
        fingerprint: 'E3E6E6A17CFCBC46C34CEA730610906FC04FE572',
        key_expires_at: '2028-06-01T00:00:00Z',
        days_until_expiry: 730,
      },
      effective_source: 'embedded',
      expiry_warning_days: 60,
      status: 'ok',
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ReleasesGPGKeyStatus', () => {
  it('shows loading spinner initially', () => {
    mockGetReleasesGPGKeys.mockReturnValue(new Promise(() => {}))
    renderComponent()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders key rows when data loads', async () => {
    mockGetReleasesGPGKeys.mockResolvedValue(okResponse)
    renderComponent()

    await waitFor(() => expect(screen.getByText('terraform')).toBeInTheDocument())
    expect(screen.getByText('opentofu')).toBeInTheDocument()
    expect(screen.getByText('cache')).toBeInTheDocument()
    expect(screen.getByText('embedded')).toBeInTheDocument()
  })

  it('shows error alert on fetch failure', async () => {
    mockGetReleasesGPGKeys.mockRejectedValue(new Error('network'))
    renderComponent()

    await waitFor(() =>
      expect(screen.getByText('Failed to load GPG key status.')).toBeInTheDocument(),
    )
  })

  it('shows status chips with correct labels', async () => {
    const warnResponse: ReleasesGPGKeysResponse = {
      keys: [
        {
          ...okResponse.keys[0],
          status: 'warn',
          cache: { ...okResponse.keys[0].cache!, days_until_expiry: 30 },
        },
      ],
    }
    mockGetReleasesGPGKeys.mockResolvedValue(warnResponse)
    renderComponent()

    await waitFor(() => expect(screen.getByText('warn')).toBeInTheDocument())
  })

  it('shows expired status', async () => {
    const expiredResponse: ReleasesGPGKeysResponse = {
      keys: [
        {
          ...okResponse.keys[0],
          status: 'expired',
          cache: { ...okResponse.keys[0].cache!, days_until_expiry: -5 },
        },
      ],
    }
    mockGetReleasesGPGKeys.mockResolvedValue(expiredResponse)
    renderComponent()

    await waitFor(() => expect(screen.getByText('expired')).toBeInTheDocument())
  })

  it('renders an unmanaged-key binary row (none source, unknown status)', async () => {
    const noneResponse: ReleasesGPGKeysResponse = {
      keys: [
        {
          tool: 'opa',
          cache: null,
          embedded: null,
          effective_source: 'none',
          expiry_warning_days: 60,
          status: 'unknown',
        },
      ],
    }
    mockGetReleasesGPGKeys.mockResolvedValue(noneResponse)
    renderComponent()

    await waitFor(() => expect(screen.getByText('opa')).toBeInTheDocument())
    expect(screen.getByText('none')).toBeInTheDocument()
    expect(screen.getByText('unknown')).toBeInTheDocument()
  })
})
