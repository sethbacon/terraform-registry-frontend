import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

// ---- Mocks ----

const getSetupStatusMock = vi.fn()
const searchModulesMock = vi.fn()
const searchProvidersMock = vi.fn()
const listPublicTerraformMirrorConfigsMock = vi.fn()

vi.mock('../../services/api', () => ({
  default: {
    getSetupStatus: (...args: unknown[]) => getSetupStatusMock(...args),
    searchModules: (...args: unknown[]) => searchModulesMock(...args),
    searchProviders: (...args: unknown[]) => searchProvidersMock(...args),
    listPublicTerraformMirrorConfigs: (...args: unknown[]) => listPublicTerraformMirrorConfigsMock(...args),
  },
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

import HomePage from '../HomePage'

// ---- Helpers ----

function renderPage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

function mockSuccessfulLoad() {
  getSetupStatusMock.mockResolvedValue({ setup_required: false })
  searchModulesMock.mockResolvedValue({
    modules: [
      { namespace: 'hashicorp', name: 'consul', system: 'aws' },
      { namespace: 'hashicorp', name: 'vault', system: 'aws' },
    ],
    meta: { total: 10 },
  })
  searchProvidersMock.mockResolvedValue({
    providers: [
      { namespace: 'hashicorp', type: 'aws' },
    ],
    meta: { total: 5 },
  })
  listPublicTerraformMirrorConfigsMock.mockResolvedValue([
    { name: 'terraform', tool: 'terraform' },
  ])
}

// ---- Tests ----

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders heading after data loads', async () => {
    mockSuccessfulLoad()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Private Terraform Registry')).toBeInTheDocument()
    })
  })

  it('shows module count and provider count after load', async () => {
    mockSuccessfulLoad()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/10 modules/)).toBeInTheDocument()
    })
    expect(screen.getByText(/5 providers/)).toBeInTheDocument()
  })

  it('shows the search field', async () => {
    mockSuccessfulLoad()
    renderPage()
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search modules/)).toBeInTheDocument()
    })
  })

  it('shows setup required alert when setup_required is true', async () => {
    getSetupStatusMock.mockResolvedValue({ setup_required: true })
    searchModulesMock.mockResolvedValue({
      modules: [],
      meta: { total: 0 },
    })
    searchProvidersMock.mockResolvedValue({
      providers: [],
      meta: { total: 0 },
    })
    listPublicTerraformMirrorConfigsMock.mockResolvedValue([])

    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Setup Required')).toBeInTheDocument()
    })
    expect(screen.getByText(/This registry has not been configured yet/)).toBeInTheDocument()
  })

  it('shows CLI usage section with credentials snippet', async () => {
    mockSuccessfulLoad()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Getting Started')).toBeInTheDocument()
    })
    expect(screen.getByText(/Get an API Key/)).toBeInTheDocument()
    expect(screen.getByText(/token = "<your-api-key>"/)).toBeInTheDocument()
  })

  it('shows module names from search results', async () => {
    mockSuccessfulLoad()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('hashicorp/consul')).toBeInTheDocument()
    })
    expect(screen.getByText('hashicorp/vault')).toBeInTheDocument()
  })

  it('shows toggle buttons for search type', async () => {
    mockSuccessfulLoad()
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Modules' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Providers' })).toBeInTheDocument()
  })

  it('does not show setup alert when setup_required is false', async () => {
    mockSuccessfulLoad()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Private Terraform Registry')).toBeInTheDocument()
    })
    expect(screen.queryByText('Setup Required')).not.toBeInTheDocument()
  })
})
