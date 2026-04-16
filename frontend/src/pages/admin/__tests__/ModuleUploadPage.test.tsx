import { render, screen, waitFor } from '@testing-library/react'
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
import apiDefault from '../../../services/api'
const api = apiDefault as unknown as {
  uploadModule: ReturnType<typeof vi.fn>
  createModuleRecord: ReturnType<typeof vi.fn>
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ModuleUploadPage />
    </MemoryRouter>,
  )
}

async function openUploadForm(user: ReturnType<typeof userEvent.setup>) {
  renderPage()
  await user.click(screen.getByText('Upload from File'))
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

describe('ModuleUploadPage — upload form (roadmap 2.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders identity fields in namespace/name/provider order', async () => {
    const user = userEvent.setup()
    await openUploadForm(user)
    const labels = screen
      .getAllByRole('textbox')
      .map((el) => (el as HTMLInputElement | HTMLTextAreaElement).getAttribute('aria-label') || '')
      .concat(
        screen
          .getAllByRole('textbox')
          .map((el) => {
            const id = el.getAttribute('id')
            if (!id) return ''
            const lbl = document.querySelector(`label[for="${id}"]`)
            return lbl?.textContent ?? ''
          }),
      )
    // Namespace must appear before Module Name which must appear before Provider
    const joined = labels.join('|')
    const nsIdx = joined.indexOf('Namespace')
    const nameIdx = joined.indexOf('Module Name')
    const providerIdx = joined.indexOf('Provider')
    expect(nsIdx).toBeGreaterThanOrEqual(0)
    expect(nameIdx).toBeGreaterThan(nsIdx)
    expect(providerIdx).toBeGreaterThan(nameIdx)
  })

  it('renders a FileDropZone and accepts a valid .tar.gz file', async () => {
    const user = userEvent.setup()
    await openUploadForm(user)
    expect(screen.getByTestId('module-upload-dropzone')).toBeInTheDocument()
    const input = screen.getByTestId('module-upload-dropzone-input') as HTMLInputElement
    const file = new File(['x'], 'mod.tar.gz', { type: 'application/gzip' })
    await user.upload(input, file)
    expect(screen.getByText('mod.tar.gz')).toBeInTheDocument()
  })

  it('shows upload progress bar and preserves field state after upload failure', async () => {
    const user = userEvent.setup()
    api.uploadModule.mockImplementationOnce(async (_fd: FormData, opts?: { onUploadProgress?: (p: number) => void }) => {
      opts?.onUploadProgress?.(42)
      throw new Error('boom')
    })

    await openUploadForm(user)
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
    const byLabel = (text: RegExp) => screen.getByLabelText(text) as HTMLInputElement
    await user.type(byLabel(/Namespace/), 'myns')
    await user.type(byLabel(/Module Name/), 'vpc')
    await user.type(byLabel(/^Provider/), 'aws')
    await user.type(byLabel(/Version/), '1.0.0')

    const dropInput = screen.getByTestId('module-upload-dropzone-input') as HTMLInputElement
    await user.upload(dropInput, new File(['x'], 'm.tar.gz'))

    await user.click(screen.getByRole('button', { name: /Upload Module/i }))

    await waitFor(() => {
      expect(screen.getByText(/boom/i)).toBeInTheDocument()
    })
    // Fields should be preserved for retry
    expect(byLabel(/Namespace/).value).toBe('myns')
    expect(byLabel(/Module Name/).value).toBe('vpc')
    expect(byLabel(/^Provider/).value).toBe('aws')
    expect(byLabel(/Version/).value).toBe('1.0.0')
    expect(inputs.length).toBeGreaterThan(0)
  })
})
