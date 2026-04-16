import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const listPublicTerraformMirrorConfigsMock = vi.fn()
const listPublicTerraformVersionsMock = vi.fn()
vi.mock('../../services/api', () => ({
  default: {
    listPublicTerraformMirrorConfigs: (...args: unknown[]) => listPublicTerraformMirrorConfigsMock(...args),
    listPublicTerraformVersions: (...args: unknown[]) => listPublicTerraformVersionsMock(...args),
  },
}))

import TerraformBinariesPage from '../TerraformBinariesPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <TerraformBinariesPage />
    </MemoryRouter>,
  )
}

describe('TerraformBinariesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner initially', () => {
    listPublicTerraformMirrorConfigsMock.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders the page heading', () => {
    listPublicTerraformMirrorConfigsMock.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Terraform Binary Mirrors')).toBeInTheDocument()
  })

  it('shows empty state when no configs', async () => {
    listPublicTerraformMirrorConfigsMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('No binary mirrors configured')).toBeInTheDocument()
    })
  })

  it('renders mirror cards', async () => {
    listPublicTerraformMirrorConfigsMock.mockResolvedValue([
      { name: 'my-terraform', description: 'Official Terraform', tool: 'terraform' },
      { name: 'my-opentofu', description: 'OpenTofu builds', tool: 'opentofu' },
    ])
    listPublicTerraformVersionsMock.mockResolvedValue({ versions: [] })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('my-terraform')).toBeInTheDocument()
      expect(screen.getByText('my-opentofu')).toBeInTheDocument()
    })
  })

  it('shows error when API fails', async () => {
    listPublicTerraformMirrorConfigsMock.mockRejectedValue(new Error('fail'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Failed to load Terraform binary mirrors.')).toBeInTheDocument()
    })
  })
})
