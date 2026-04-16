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
    useLocation: () => ({ state: null, pathname: '/admin/upload/module', search: '', hash: '' }),
  }
})

vi.mock('../../../services/api', () => ({
  default: {
    uploadModule: vi.fn(),
    createModuleRecord: vi.fn(),
  },
}))

vi.mock('../../../components/PublishFromSCMWizard', () => ({
  default: () => <div data-testid="scm-wizard">SCM Wizard</div>,
}))

import ModuleUploadPage from '../../admin/ModuleUploadPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <ModuleUploadPage />
    </MemoryRouter>,
  )
}

describe('ModuleUploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page heading', () => {
    renderPage()
    expect(screen.getByText('Upload Module')).toBeInTheDocument()
    expect(screen.getByText('Publish a Terraform module to your registry')).toBeInTheDocument()
  })

  it('shows method chooser by default', () => {
    renderPage()
    expect(screen.getByText('How would you like to publish this module?')).toBeInTheDocument()
    expect(screen.getByText('Upload from File')).toBeInTheDocument()
    expect(screen.getByText('Link from SCM Repository')).toBeInTheDocument()
  })

  it('switches to upload form when Upload from File is clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Upload from File'))
    expect(screen.getByText('Upload Terraform Module')).toBeInTheDocument()
    expect(screen.getByLabelText(/Namespace/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Module Name/)).toBeInTheDocument()
  })

  it('switches to SCM form when Link from SCM is clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Link from SCM Repository'))
    expect(screen.getByText('Link Module to SCM Repository')).toBeInTheDocument()
  })

  it('shows requirements in the upload form', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Upload from File'))
    expect(screen.getByText(/Requirements:/)).toBeInTheDocument()
  })

  it('has back button in upload form', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Upload from File'))
    await user.click(screen.getByText('Back'))
    expect(screen.getByText('How would you like to publish this module?')).toBeInTheDocument()
  })

  it('has back button in SCM form', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Link from SCM Repository'))
    await user.click(screen.getByText('Back'))
    expect(screen.getByText('How would you like to publish this module?')).toBeInTheDocument()
  })

  it('disables upload button when no file selected', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Upload from File'))
    const uploadButton = screen.getByRole('button', { name: /Upload Module/i })
    expect(uploadButton).toBeDisabled()
  })

  it('disables SCM continue button when required fields empty', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Link from SCM Repository'))
    const continueButton = screen.getByRole('button', { name: /Continue to Repository Selection/i })
    expect(continueButton).toBeDisabled()
  })
})
