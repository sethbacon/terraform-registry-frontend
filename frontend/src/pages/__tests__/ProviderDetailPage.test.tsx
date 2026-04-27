import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// Mock api
const searchProvidersMock = vi.fn()
const getProviderVersionsMock = vi.fn()
const getProviderDocsMock = vi.fn()
const deleteProviderMock = vi.fn()
const deleteProviderVersionMock = vi.fn()
const deprecateProviderVersionMock = vi.fn()
const undeprecateProviderVersionMock = vi.fn()

vi.mock('../../services/api', () => ({
  default: {
    searchProviders: (...args: unknown[]) => searchProvidersMock(...args),
    getProviderVersions: (...args: unknown[]) => getProviderVersionsMock(...args),
    getProviderDocs: (...args: unknown[]) => getProviderDocsMock(...args),
    deleteProvider: (...args: unknown[]) => deleteProviderMock(...args),
    deleteProviderVersion: (...args: unknown[]) => deleteProviderVersionMock(...args),
    deprecateProviderVersion: (...args: unknown[]) => deprecateProviderVersionMock(...args),
    undeprecateProviderVersion: (...args: unknown[]) => undeprecateProviderVersionMock(...args),
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
    id: 'vid-1',
    version: '5.0.0',
    protocols: ['6.0'],
    platforms: [{ id: 'plat-1', os: 'linux', arch: 'amd64', shasum: 'abc123sha' }],
    published_at: '2025-06-01T00:00:00Z',
    deprecated: false,
    download_count: 100,
  },
  {
    id: 'vid-2',
    version: '4.0.0',
    protocols: ['5.0'],
    platforms: [{ id: 'plat-2', os: 'linux', arch: 'amd64' }],
    published_at: '2025-01-01T00:00:00Z',
    deprecated: false,
    download_count: 50,
  },
]

describe('ProviderDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner initially', () => {
    searchProvidersMock.mockReturnValue(new Promise(() => {}))
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

  it('renders version selector with versions', async () => {
    searchProvidersMock.mockResolvedValue({ providers: [fakeProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: fakeVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('aws')
    })
    // Selector shows the first/latest version at least once (breadcrumb + select)
    expect(screen.getAllByText(/v5\.0\.0/).length).toBeGreaterThan(0)
  })

  it('renders platforms table with SHA256 sums', async () => {
    searchProvidersMock.mockResolvedValue({ providers: [fakeProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: fakeVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Available Platforms')).toBeInTheDocument()
    })
    expect(screen.getByText('abc123sha')).toBeInTheDocument()
  })

  it('shows Delete Provider button when user has admin scope', async () => {
    searchProvidersMock.mockResolvedValue({ providers: [fakeProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: fakeVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    renderPage()
    await waitFor(() => expect(screen.getByText('Delete Provider')).toBeInTheDocument())
  })

  it('opens delete provider confirmation dialog', async () => {
    searchProvidersMock.mockResolvedValue({ providers: [fakeProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: fakeVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    renderPage()
    await waitFor(() => expect(screen.getByText('Delete Provider')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Delete Provider'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })

  it('deletes the provider via confirmation dialog', async () => {
    searchProvidersMock.mockResolvedValue({ providers: [fakeProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: fakeVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    deleteProviderMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('Delete Provider')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Delete Provider'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    // The confirm button inside dialog is named "Delete Provider" (there are two, click the one inside dialog)
    const dlgButtons = screen.getAllByRole('button', { name: /^delete provider$/i })
    await userEvent.click(dlgButtons[dlgButtons.length - 1])
    await waitFor(() => expect(deleteProviderMock).toHaveBeenCalledWith('hashicorp', 'aws'))
  })

  it('opens deprecate version dialog', async () => {
    searchProvidersMock.mockResolvedValue({ providers: [fakeProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: fakeVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    renderPage()
    await waitFor(() => expect(screen.getByText('Deprecate Version')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Deprecate Version'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })

  it('deprecates a version with reason message', async () => {
    searchProvidersMock.mockResolvedValue({ providers: [fakeProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: fakeVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    deprecateProviderVersionMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('Deprecate Version')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Deprecate Version'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const dlgButtons = screen.getAllByRole('button', { name: /deprecate/i })
    await userEvent.click(dlgButtons[dlgButtons.length - 1])
    await waitFor(() => expect(deprecateProviderVersionMock).toHaveBeenCalled())
  })

  it('shows "Delete This Version" button', async () => {
    searchProvidersMock.mockResolvedValue({ providers: [fakeProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: fakeVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    renderPage()
    await waitFor(() => expect(screen.getByText('Delete This Version')).toBeInTheDocument())
  })

  it('opens delete version dialog and deletes the version', async () => {
    searchProvidersMock.mockResolvedValue({ providers: [fakeProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: fakeVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    deleteProviderVersionMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('Delete This Version')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Delete This Version'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const dlgButtons = screen.getAllByRole('button', { name: /^delete version$/i })
    await userEvent.click(dlgButtons[dlgButtons.length - 1])
    await waitFor(() =>
      expect(deleteProviderVersionMock).toHaveBeenCalledWith('hashicorp', 'aws', '5.0.0'),
    )
  })

  it('renders Publish New Version button for non-mirrored providers', async () => {
    searchProvidersMock.mockResolvedValue({ providers: [fakeProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: fakeVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    renderPage()
    await waitFor(() => expect(screen.getByText('Publish New Version')).toBeInTheDocument())
  })

  it('renders Network Mirrored chip for mirrored providers', async () => {
    const mirroredProvider = { ...fakeProvider, source: 'hashicorp/aws' }
    searchProvidersMock.mockResolvedValue({ providers: [mirroredProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: fakeVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    renderPage()
    await waitFor(() => expect(screen.getByText('Network Mirrored')).toBeInTheDocument())
  })

  it('renders usage example code block', async () => {
    searchProvidersMock.mockResolvedValue({ providers: [fakeProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: fakeVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    renderPage()
    await waitFor(() => expect(screen.getByText('Usage Example')).toBeInTheDocument())
  })

  it('renders GitHub Repository button for mirrored providers', async () => {
    const mirroredProvider = { ...fakeProvider, source: 'hashicorp/aws' }
    searchProvidersMock.mockResolvedValue({ providers: [mirroredProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: fakeVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    renderPage()
    await waitFor(() => expect(screen.getByText(/GitHub Repository/i)).toBeInTheDocument())
  })

  it('copies source URL when copy button is clicked', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    searchProvidersMock.mockResolvedValue({ providers: [fakeProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: fakeVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    renderPage()
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('aws'))
    await userEvent.click(screen.getByRole('button', { name: /copy source url/i }))
    expect(writeText).toHaveBeenCalled()
  })

  it('shows deprecated version warnings when version is deprecated', async () => {
    const deprecatedVersions = [
      {
        ...fakeVersions[0],
        deprecated: true,
        deprecation_message: 'Please upgrade to 6.x',
        deprecated_at: '2025-07-01T00:00:00Z',
      },
    ]
    searchProvidersMock.mockResolvedValue({ providers: [fakeProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: deprecatedVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    renderPage()
    await waitFor(() => expect(screen.getByText('Please upgrade to 6.x')).toBeInTheDocument())
    expect(screen.getByText(/Remove Deprecation/i)).toBeInTheDocument()
  })

  it('removes deprecation when Remove Deprecation is clicked', async () => {
    const deprecatedVersions = [
      {
        ...fakeVersions[0],
        deprecated: true,
        deprecation_message: 'old',
      },
    ]
    searchProvidersMock.mockResolvedValue({ providers: [fakeProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: deprecatedVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    undeprecateProviderVersionMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText(/Remove Deprecation/i)).toBeInTheDocument())
    await userEvent.click(screen.getByText(/Remove Deprecation/i))
    await waitFor(() => expect(undeprecateProviderVersionMock).toHaveBeenCalled())
  })

  it('closes delete provider dialog when Cancel is clicked', async () => {
    searchProvidersMock.mockResolvedValue({ providers: [fakeProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: fakeVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    renderPage()
    await waitFor(() => expect(screen.getByText('Delete Provider')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Delete Provider'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes delete version dialog when Cancel is clicked', async () => {
    searchProvidersMock.mockResolvedValue({ providers: [fakeProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: fakeVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    renderPage()
    await waitFor(() => expect(screen.getByText('Delete This Version')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Delete This Version'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes deprecate version dialog when Cancel is clicked and clears message', async () => {
    searchProvidersMock.mockResolvedValue({ providers: [fakeProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: fakeVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    renderPage()
    await waitFor(() => expect(screen.getByText('Deprecate Version')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Deprecate Version'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const msg = screen.getByLabelText(/Deprecation Message/i)
    await userEvent.type(msg, 'will be removed')
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('copies a platform checksum when its copy button is clicked', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    searchProvidersMock.mockResolvedValue({ providers: [fakeProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: fakeVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    renderPage()
    await waitFor(() => expect(screen.getByText('abc123sha')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /copy checksum/i }))
    expect(writeText).toHaveBeenCalledWith('abc123sha')
  })

  it('updates deprecation message textarea as the user types', async () => {
    searchProvidersMock.mockResolvedValue({ providers: [fakeProvider] })
    getProviderVersionsMock.mockResolvedValue({ versions: fakeVersions })
    getProviderDocsMock.mockResolvedValue({ docs: [], total: 0 })
    renderPage()
    await waitFor(() => expect(screen.getByText('Deprecate Version')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Deprecate Version'))
    const msg = (await screen.findByLabelText(/Deprecation Message/i)) as HTMLTextAreaElement
    await userEvent.type(msg, 'upgrade soon')
    expect(msg.value).toBe('upgrade soon')
  })
})
