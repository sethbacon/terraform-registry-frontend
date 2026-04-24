import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getVersionInfoMock = vi.fn()
vi.mock('../../services/api', () => ({
  default: {
    getVersionInfo: (...args: unknown[]) => getVersionInfoMock(...args),
  },
}))

vi.mock('../../contexts/ThemeContext', () => ({
  useThemeMode: () => ({
    mode: 'light',
    toggleTheme: vi.fn(),
    productName: 'Terraform Registry',
    logoUrl: null,
    loginHeroUrl: null,
    direction: 'ltr' as const,
  }),
}))

import AboutModal from '../AboutModal'

describe('AboutModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not fetch version info when closed', () => {
    render(<AboutModal open={false} onClose={vi.fn()} />)
    expect(getVersionInfoMock).not.toHaveBeenCalled()
  })

  it('fetches version info when opened', async () => {
    getVersionInfoMock.mockResolvedValue({
      version: '1.2.3',
      api_version: 'v1',
      build_date: '2025-06-01T00:00:00Z',
    })
    render(<AboutModal open={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(getVersionInfoMock).toHaveBeenCalled()
    })
  })

  it('renders the dialog title', () => {
    getVersionInfoMock.mockReturnValue(new Promise(() => {}))
    render(<AboutModal open={true} onClose={vi.fn()} />)
    expect(screen.getByText('About Terraform Registry')).toBeInTheDocument()
  })

  it('shows loading state while fetching backend version', () => {
    getVersionInfoMock.mockReturnValue(new Promise(() => {}))
    render(<AboutModal open={true} onClose={vi.fn()} />)
    expect(screen.getByText('Loading backend version…')).toBeInTheDocument()
  })

  it('shows backend version after load', async () => {
    getVersionInfoMock.mockResolvedValue({
      version: '1.2.3',
      api_version: 'v1',
      build_date: '2025-06-01T00:00:00Z',
    })
    render(<AboutModal open={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Backend v1.2.3')).toBeInTheDocument()
    })
    expect(screen.getByText('API version: v1')).toBeInTheDocument()
  })

  it('shows "Backend unavailable" when API fails', async () => {
    getVersionInfoMock.mockRejectedValue(new Error('Network error'))
    render(<AboutModal open={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Backend unavailable')).toBeInTheDocument()
    })
  })

  it('calls onClose when Close button is clicked', async () => {
    const onClose = vi.fn()
    getVersionInfoMock.mockResolvedValue({ version: '1.0.0', api_version: 'v1' })
    const user = userEvent.setup()
    render(<AboutModal open={true} onClose={onClose} />)
    await user.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows license section', () => {
    getVersionInfoMock.mockReturnValue(new Promise(() => {}))
    render(<AboutModal open={true} onClose={vi.fn()} />)
    expect(screen.getByText('License')).toBeInTheDocument()
    expect(screen.getByText('Apache License 2.0')).toBeInTheDocument()
  })

  it('shows source links', () => {
    getVersionInfoMock.mockReturnValue(new Promise(() => {}))
    render(<AboutModal open={true} onClose={vi.fn()} />)
    expect(screen.getByText('Source')).toBeInTheDocument()
    expect(screen.getByText('GitHub — Backend')).toBeInTheDocument()
    expect(screen.getByText('GitHub — Frontend')).toBeInTheDocument()
  })

  it('shows build date when available', async () => {
    getVersionInfoMock.mockResolvedValue({
      version: '1.0.0',
      api_version: 'v1',
      build_date: '2025-06-01T00:00:00Z',
    })
    render(<AboutModal open={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText(/Built:/)).toBeInTheDocument()
    })
  })

  it('does not show build date when unknown', async () => {
    getVersionInfoMock.mockResolvedValue({
      version: '1.0.0',
      api_version: 'v1',
      build_date: 'unknown',
    })
    render(<AboutModal open={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Backend v1.0.0')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Built:/)).not.toBeInTheDocument()
  })
})
