import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'

const getAdminUIThemeMock = vi.fn()
const updateAdminUIThemeMock = vi.fn()
vi.mock('../../../services/api', () => ({
  default: {
    getAdminUITheme: (...args: unknown[]) => getAdminUIThemeMock(...args),
    updateAdminUITheme: (...args: unknown[]) => updateAdminUIThemeMock(...args),
  },
}))

let mockAllowedScopes: string[] = ['admin']
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ allowedScopes: mockAllowedScopes }),
}))

import BrandingPage from '../../admin/BrandingPage'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <BrandingPage />
    </QueryClientProvider>,
  )
}

describe('BrandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAllowedScopes = ['admin']
    getAdminUIThemeMock.mockResolvedValue({ product_name: 'Acme Registry', primary_color: '#5C4EE5' })
    updateAdminUIThemeMock.mockResolvedValue({})
  })

  it('renders the saved branding config', async () => {
    renderPage()
    expect(await screen.findByDisplayValue('Acme Registry')).toBeInTheDocument()
    expect(screen.getByDisplayValue('#5C4EE5')).toBeInTheDocument()
  })

  it('treats an unset theme as an empty form rather than an error', async () => {
    getAdminUIThemeMock.mockResolvedValue(null)
    renderPage()
    await waitFor(() => expect(screen.getByLabelText('Product name')).toHaveValue(''))
  })

  it('saves edits through the admin endpoint', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByDisplayValue('Acme Registry')

    const name = screen.getByLabelText('Product name')
    await user.clear(name)
    await user.type(name, 'Globex Registry')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(updateAdminUIThemeMock).toHaveBeenCalledWith({
        product_name: 'Globex Registry',
        primary_color: '#5C4EE5',
      }),
    )
  })

  it('rejects a color the backend would reject, without calling the API', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByDisplayValue('Acme Registry')

    const color = screen.getByLabelText('Primary color')
    await user.clear(color)
    // Valid for the state-manager backend, but the registry accepts hex only.
    await user.type(color, 'rgb(92,78,229)')

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(updateAdminUIThemeMock).not.toHaveBeenCalled()
  })

  it("surfaces the backend's validation detail rather than the axios message", async () => {
    const axiosError = new AxiosError('Request failed with status code 400')
    axiosError.response = {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
      data: { error: 'primary_color: must be a hex color like #5C4EE5' },
    }
    updateAdminUIThemeMock.mockRejectedValue(axiosError)
    const user = userEvent.setup()
    renderPage()
    await screen.findByDisplayValue('Acme Registry')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText(/must be a hex color/)).toBeInTheDocument()
    expect(screen.queryByText(/Request failed with status code/)).not.toBeInTheDocument()
  })

  // A failed read must not degrade into an empty form. The backend PUT is a
  // full replace, so saving from a blank form after a failed load would wipe
  // every stored value the admin was never shown.
  it('refuses to render the form when the theme could not be loaded', async () => {
    getAdminUIThemeMock.mockRejectedValue(new Error('boom'))
    renderPage()

    expect(await screen.findByText('Failed to load the current branding.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Product name')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('renders read-only for a non-admin', async () => {
    mockAllowedScopes = []
    renderPage()
    await screen.findByDisplayValue('Acme Registry')
    expect(screen.getByLabelText('Product name')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})
