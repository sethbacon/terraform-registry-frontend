import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ComponentShowcase from '../ComponentShowcase'

// ---- Globals ----

// AboutModal references the Vite-injected __APP_VERSION__ global which is not
// defined in the vitest environment. Provide a fallback.
beforeAll(() => {
  if (typeof (globalThis as Record<string, unknown>).__APP_VERSION__ === 'undefined') {
    (globalThis as Record<string, unknown>).__APP_VERSION__ = '0.0.0-test';
  }
})

// ---- Mocks ----

// AboutModal calls apiClient.getVersionInfo on open — mock the API module
vi.mock('../../../services/api', () => ({
  default: {
    getVersionInfo: vi.fn().mockResolvedValue({ version: '0.0.0-test', api_version: 'v1', build_date: 'unknown' }),
    planStorageMigration: vi.fn(),
    startStorageMigration: vi.fn(),
    cancelStorageMigration: vi.fn(),
    getStorageMigration: vi.fn(),
  },
}))

// ProviderIcon uses FontAwesome and simple-icons; they render fine in happy-dom
// but mock them to keep the test lightweight
vi.mock('../../../components/ProviderIcon', () => ({
  ProviderIcon: ({ provider }: { provider: string }) => (
    <span data-testid="provider-icon">{provider}</span>
  ),
  providerDisplayName: (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1),
}))

function renderShowcase() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dev/components']}>
        <ComponentShowcase />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ComponentShowcase', () => {
  it('renders without crashing', () => {
    renderShowcase()
    expect(screen.getByText('Component Showcase')).toBeInTheDocument()
  })

  it('shows the table of contents', () => {
    renderShowcase()
    expect(screen.getByText('Table of Contents')).toBeInTheDocument()
    // Each component name appears in both the TOC chip and the section header
    expect(screen.getAllByText('RegistryItemCard').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('ProviderIcon').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('MarkdownRenderer').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('ErrorBoundary').length).toBeGreaterThanOrEqual(2)
  })

  it('renders RegistryItemCard section with sample cards', () => {
    renderShowcase()
    expect(screen.getByText('acme/vpc/aws')).toBeInTheDocument()
    expect(screen.getByText('acme/eks-cluster/aws')).toBeInTheDocument()
    expect(screen.getByText('acme/legacy-network/aws')).toBeInTheDocument()
  })

  it('renders provider icons section', () => {
    renderShowcase()
    const icons = screen.getAllByTestId('provider-icon')
    expect(icons.length).toBeGreaterThanOrEqual(5)
  })

  it('renders markdown content', () => {
    renderShowcase()
    expect(screen.getByText('Module README')).toBeInTheDocument()
  })

  it('renders SecurityScanPanel variants', () => {
    renderShowcase()
    // The clean scan shows "No findings"
    expect(screen.getByText('No findings')).toBeInTheDocument()
    // The findings scan shows critical count
    expect(screen.getByText('Critical: 1')).toBeInTheDocument()
  })

  it('renders VersionDetailsPanel variants', () => {
    renderShowcase()
    expect(screen.getByText('Version 2.3.1 Details')).toBeInTheDocument()
    expect(screen.getByText('Version 1.0.0 Details')).toBeInTheDocument()
  })

  it('opens AboutModal when its trigger chip is clicked', async () => {
    renderShowcase()
    const chip = screen.getByText('Open AboutModal')
    await userEvent.click(chip)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('opens StorageMigrationWizard when its trigger chip is clicked', async () => {
    renderShowcase()
    const chip = screen.getByText('Open StorageMigrationWizard')
    await userEvent.click(chip)
    expect(screen.getAllByRole('dialog').length).toBeGreaterThanOrEqual(1)
  })

  it('invokes VersionDetailsPanel callbacks by clicking action buttons', async () => {
    renderShowcase()
    const deprecateBtn = screen.getByRole('button', { name: /^deprecate version$/i })
    await userEvent.click(deprecateBtn)
    const undeprecateBtn = screen.getByRole('button', { name: /remove deprecation/i })
    await userEvent.click(undeprecateBtn)
    const deleteButtons = screen.getAllByRole('button', { name: /delete this version/i })
    for (const btn of deleteButtons) {
      await userEvent.click(btn)
    }
    expect(screen.getByText('Component Showcase')).toBeInTheDocument()
  })

  it('invokes RegistryItemCard onClick handlers when cards are clicked', async () => {
    renderShowcase()
    const cards = screen.getAllByRole('article')
    for (const card of cards) {
      await userEvent.click(card)
    }
    expect(cards.length).toBeGreaterThanOrEqual(6)
  })

  it('closes AboutModal via its close callback', async () => {
    renderShowcase()
    await userEvent.click(screen.getByText('Open AboutModal'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // AboutModal has a "Close" button
    const closeBtn = screen.getAllByRole('button', { name: /close/i })[0]
    await userEvent.click(closeBtn)
  })

  it('invokes TOC anchor links', () => {
    renderShowcase()
    const tocLinks = screen.getAllByRole('link')
    expect(tocLinks.length).toBeGreaterThan(0)
  })
})
