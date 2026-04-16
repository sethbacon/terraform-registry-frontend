import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

vi.mock('../../../services/api', () => ({
  default: {
    uploadProvider: vi.fn(),
  },
}))

import ProviderUploadPage from '../../admin/ProviderUploadPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <ProviderUploadPage />
    </MemoryRouter>,
  )
}

describe('ProviderUploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page heading', () => {
    renderPage()
    expect(screen.getByText('Upload Provider')).toBeInTheDocument()
    expect(screen.getByText('Add a Terraform provider to your registry')).toBeInTheDocument()
  })

  it('shows method chooser by default', () => {
    renderPage()
    expect(screen.getByText('How would you like to add this provider?')).toBeInTheDocument()
    expect(screen.getByText('Manual Upload')).toBeInTheDocument()
    expect(screen.getByText('Provider Mirror')).toBeInTheDocument()
  })

  it('switches to upload form when Manual Upload is clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Manual Upload'))
    expect(screen.getByText('Upload Terraform Provider')).toBeInTheDocument()
    expect(screen.getByLabelText(/Namespace/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Provider Name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Version/)).toBeInTheDocument()
  })

  it('shows requirements section in upload form', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Manual Upload'))
    expect(screen.getByText(/Requirements:/)).toBeInTheDocument()
  })

  it('navigates to mirrors when Provider Mirror is clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Provider Mirror'))
    expect(mockNavigate).toHaveBeenCalledWith('/admin/mirrors?action=add')
  })

  it('has a back button in upload form', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Manual Upload'))
    expect(screen.getByText('Back')).toBeInTheDocument()
  })

  it('goes back to chooser when Back is clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Manual Upload'))
    await user.click(screen.getByText('Back'))
    expect(screen.getByText('How would you like to add this provider?')).toBeInTheDocument()
  })

  it('disables upload button when no file selected', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Manual Upload'))
    const uploadButton = screen.getByRole('button', { name: /Upload Provider/i })
    expect(uploadButton).toBeDisabled()
  })
})
