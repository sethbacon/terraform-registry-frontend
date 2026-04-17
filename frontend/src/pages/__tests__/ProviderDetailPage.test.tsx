import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// Mock api
const searchProvidersMock = vi.fn()
const getProviderVersionsMock = vi.fn()
const getProviderDocsMock = vi.fn()

vi.mock('../../services/api', () => ({
  default: {
    searchProviders: (...args: unknown[]) => searchProvidersMock(...args),
    getProviderVersions: (...args: unknown[]) => getProviderVersionsMock(...args),
    getProviderDocs: (...args: unknown[]) => getProviderDocsMock(...args),
    deleteProvider: vi.fn(),
    deleteProviderVersion: vi.fn(),
    deprecateProviderVersion: vi.fn(),
    undeprecateProviderVersion: vi.fn(),
  },
}))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    allowedScopes: ['admin'],
  }),
}))

vi.mock('../../config', () => ({
  REGISTRY_HOST: 'registry.example.com',
}))

vi.mock('../../components/ProviderDocsSidebar', () => ({
  default: () => <div data-testid="provider-docs-sidebar" />,
}))

vi.mock('../../components/ProviderDocContent', () => ({
  default: () => <div data-testid="provider-doc-content" />,
}))

import ProviderDetailPage from '../ProviderDetailPage'

function renderPage(path = '/providers/hashicorp/aws') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/providers/:namespace/:type" element={<ProviderDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const fakeProvider = {
  id: 'p1',
  namespace: 'hashicorp',
  type: 'aws',
  description: 'AWS provider',
  published_at: '2025-01-01T00:00:00Z',
  downloads: 5000,
  is_mirrored: false,
  source_repo_url: 'https://github.com/hashicorp/terraform-provider-aws',
}

const fakeVersions = [
  {
    version: '5.0.0',
    protocols: ['6.0'],
    platforms: [{ os: 'linux', arch: 'amd64' }],
    published_at: '2025-06-01T00:00:00Z',
    deprecated: false,
  },
  {
    version: '4.0.0',
    protocols: ['5.0'],
    platforms: [{ os: 'linux', arch: 'amd64' }],
    published_at: '2025-01-01T00:00:00Z',
    deprecated: false,
  },
]

describe('ProviderDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner initially', () => {
    searchProvidersMock.mockReturnValue(new Promise(() => { }))
    renderPage()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows error alert when provider not found', async () => {
    searchProvidersMock.mockResolvedValue({ providers: [] })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/provider not found/i)).toBeInTheDocument()
    })
  })

  it('shows error alert on API failure', async () => {
    searchProvidersMock.mockRejectedValue(new Error('Network error'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/failed to load provider details/i)).toBeInTheDocument()
    })
  })

  it('renders provider details after loading', async () => {
    searchProvidersMock.mockResolvedValue({ providers: [fakeProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: fakeVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('aws')
    })
  })

  it('renders breadcrumbs', async () => {
    searchProvidersMock.mockResolvedValue({ providers: [fakeProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: fakeVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Providers')).toBeInTheDocument()
    })
  })

  it('shows back button', async () => {
    searchProvidersMock.mockRejectedValue(new Error('fail'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back to providers/i })).toBeInTheDocument()
    })
  })
})
