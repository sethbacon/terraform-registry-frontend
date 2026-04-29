import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// ── Mock api client ────────────────────────────────────────────────────────

const mockGetActiveAdvisories = vi.fn()

vi.mock('../../services/api', () => ({
  default: {
    getActiveAdvisories: (...args: unknown[]) => mockGetActiveAdvisories(...args),
  },
}))

// ── Helpers ────────────────────────────────────────────────────────────────

import AdvisoryBanner from '../AdvisoryBanner'
import type { CVEAdvisory } from '../../types'

function makeAdvisory(overrides: Partial<CVEAdvisory> = {}): CVEAdvisory {
  return {
    id: 'adv-1',
    source_id: 'CVE-2024-1234',
    severity: 'high',
    summary: 'Remote code execution in terraform binary',
    references: ['https://example.com/cve-1234'],
    target_kind: 'binary',
    targets: [],
    ...overrides,
  }
}

function renderBanner() {
  // Use a fresh QueryClient per test so cached query data doesn't bleed between tests.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdvisoryBanner />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  // Clear any banner dismissal flags persisted from a previous test.
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith('cve_banner_dismissed_')) sessionStorage.removeItem(key)
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AdvisoryBanner', () => {
  // 1. Nothing rendered when there are no active advisories
  it('renders nothing when getActiveAdvisories returns an empty array', async () => {
    mockGetActiveAdvisories.mockResolvedValue([])

    const { container } = renderBanner()

    await waitFor(() => expect(mockGetActiveAdvisories).toHaveBeenCalledOnce())
    expect(container.firstChild).toBeNull()
  })

  // 2. Nothing rendered while the query is loading (placeholderData=[])
  it('renders nothing while the query has no data yet', () => {
    // Never resolves — simulates loading state.
    mockGetActiveAdvisories.mockReturnValue(new Promise(() => { }))

    const { container } = renderBanner()
    expect(container.firstChild).toBeNull()
  })

  // 3. Single advisory shows correct severity band
  it('renders a banner with the advisory severity and source ID', async () => {
    mockGetActiveAdvisories.mockResolvedValue([makeAdvisory()])

    renderBanner()

    await waitFor(() =>
      expect(screen.getByText(/high severity cve detected/i)).toBeInTheDocument(),
    )
    expect(screen.getByText(/CVE-2024-1234/)).toBeInTheDocument()
    expect(screen.getByText(/Remote code execution in terraform binary/)).toBeInTheDocument()
  })

  // 4. Multiple advisories of same severity show count
  it('shows advisory count when multiple advisories share a severity', async () => {
    mockGetActiveAdvisories.mockResolvedValue([
      makeAdvisory({ id: 'a1', source_id: 'CVE-2024-1' }),
      makeAdvisory({ id: 'a2', source_id: 'CVE-2024-2', target_kind: 'provider' }),
    ])

    renderBanner()

    await waitFor(() =>
      expect(screen.getByText(/2 advisories affect/i)).toBeInTheDocument(),
    )
  })

  // 5. Multiple severities render separate bands
  it('renders one band per severity level', async () => {
    mockGetActiveAdvisories.mockResolvedValue([
      makeAdvisory({ id: 'a1', severity: 'critical' }),
      makeAdvisory({ id: 'a2', severity: 'medium' }),
    ])

    renderBanner()

    await waitFor(() =>
      expect(screen.getByText(/critical severity cve detected/i)).toBeInTheDocument(),
    )
    expect(screen.getByText(/medium severity cve detected/i)).toBeInTheDocument()
  })

  // 6. "Review in Security Scanning" link points to correct route
  it('contains a link to /admin/security-scanning', async () => {
    mockGetActiveAdvisories.mockResolvedValue([makeAdvisory()])

    renderBanner()

    await waitFor(() => expect(screen.getByText(/Review in Security Scanning/i)).toBeInTheDocument())

    const link = screen.getByRole('link', { name: /Review in Security Scanning/i })
    expect(link).toHaveAttribute('href', '/admin/security-scanning')
  })

  // 7. Dismiss button hides the band for the session
  it('dismisses a severity band when the close button is clicked', async () => {
    mockGetActiveAdvisories.mockResolvedValue([makeAdvisory()])

    renderBanner()

    await waitFor(() =>
      expect(screen.getByText(/high severity cve detected/i)).toBeInTheDocument(),
    )

    const dismissBtn = screen.getByRole('button', { name: /dismiss high advisory banner/i })
    fireEvent.click(dismissBtn)

    await waitFor(() =>
      expect(screen.queryByText(/high severity cve detected/i)).not.toBeInTheDocument(),
    )
  })

  // 8. Dismissal is written to sessionStorage
  it('persists dismissal to sessionStorage when close is clicked', async () => {
    mockGetActiveAdvisories.mockResolvedValue([makeAdvisory()])

    renderBanner()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /dismiss high advisory banner/i })).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByRole('button', { name: /dismiss high advisory banner/i }))

    expect(sessionStorage.getItem('cve_banner_dismissed_high')).toBe('1')
  })

  // 9. Previously dismissed severity is not shown on mount
  it('does not render a band that was dismissed in the current session', async () => {
    sessionStorage.setItem('cve_banner_dismissed_high', '1')

    mockGetActiveAdvisories.mockResolvedValue([makeAdvisory()])

    const { container } = renderBanner()

    await waitFor(() => expect(mockGetActiveAdvisories).toHaveBeenCalledOnce())
    expect(container.firstChild).toBeNull()
  })

  // 10. The region landmark is accessible
  it('renders with the correct aria-label region', async () => {
    mockGetActiveAdvisories.mockResolvedValue([makeAdvisory()])

    renderBanner()

    await waitFor(() =>
      expect(screen.getByRole('region', { name: /security advisories/i })).toBeInTheDocument(),
    )
  })

  // 11. Undismissed severities still show when only one of two is dismissed
  it('keeps undismissed bands visible when another severity is dismissed', async () => {
    sessionStorage.setItem('cve_banner_dismissed_high', '1')

    mockGetActiveAdvisories.mockResolvedValue([
      makeAdvisory({ id: 'a1', severity: 'high' }),
      makeAdvisory({ id: 'a2', severity: 'critical' }),
    ])

    renderBanner()

    await waitFor(() =>
      expect(screen.getByText(/critical severity cve detected/i)).toBeInTheDocument(),
    )
    expect(screen.queryByText(/high severity cve detected/i)).not.toBeInTheDocument()
  })
})
