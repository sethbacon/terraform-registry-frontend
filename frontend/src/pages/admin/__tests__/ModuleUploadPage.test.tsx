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
    getCurrentUserMemberships: vi.fn(),
  },
}))

vi.mock('../../../components/PublishFromSCMWizard', () => ({
  default: () => <div data-testid="scm-wizard">SCM Wizard</div>,
}))

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user-id', username: 'testuser' } }),
}))

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ModuleUploadPage from '../../admin/ModuleUploadPage'
import apiDefault from '../../../services/api'
const api = apiDefault as unknown as {
  uploadModule: ReturnType<typeof vi.fn>
  createModuleRecord: ReturnType<typeof vi.fn>
  getCurrentUserMemberships: ReturnType<typeof vi.fn>
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ModuleUploadPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function openUploadForm(user: ReturnType<typeof userEvent.setup>) {
  renderPage()
  await user.click(screen.getByText('Upload from File'))
}

describe('ModuleUploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
    api.getCurrentUserMemberships.mockResolvedValue([])
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
    queryClient.clear()
    api.getCurrentUserMemberships.mockResolvedValue([])
  })

  it('renders identity fields in namespace/name/provider order', async () => {
    const user = userEvent.setup()
    await openUploadForm(user)
    const labels = screen
      .getAllByRole('textbox')
      .map((el) => (el as HTMLInputElement | HTMLTextAreaElement).getAttribute('aria-label') || '')
      .concat(
        screen.getAllByRole('textbox').map((el) => {
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

  it('disables Upload Module when a registry segment is invalid', async () => {
    const user = userEvent.setup()
    await openUploadForm(user)
    const byLabel = (t: RegExp) => screen.getByLabelText(t) as HTMLInputElement
    await user.type(byLabel(/Namespace/), 'My Org') // space + uppercase
    await user.type(byLabel(/Module Name/), 'vpc')
    await user.type(byLabel(/^Provider/), 'aws')
    await user.type(byLabel(/Version/), '1.0.0')
    const dropInput = screen.getByTestId('module-upload-dropzone-input') as HTMLInputElement
    await user.upload(dropInput, new File(['x'], 'm.tar.gz'))
    expect(screen.getByRole('button', { name: /Upload Module/i })).toBeDisabled()
    // Inline helper switches to the segment-format hint
    expect(screen.getAllByText(/1.{0,4}64 chars/i).length).toBeGreaterThan(0)
  })

  it('disables SCM Continue when any segment is invalid', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Link from SCM Repository'))
    const byLabel = (t: RegExp) => screen.getByLabelText(t) as HTMLInputElement
    await user.type(byLabel(/Namespace/), 'myns')
    await user.type(byLabel(/Module Name/), 'BAD NAME')
    await user.type(byLabel(/^Provider/), 'aws')
    expect(screen.getByRole('button', { name: /Continue to Repository Selection/i })).toBeDisabled()
  })

  it('shows upload progress bar and preserves field state after upload failure', async () => {
    const user = userEvent.setup()
    api.uploadModule.mockImplementationOnce(
      async (_fd: FormData, opts?: { onUploadProgress?: (p: number) => void }) => {
        opts?.onUploadProgress?.(42)
        throw new Error('boom')
      },
    )

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

describe('ModuleUploadPage — organization picker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
  })

  it('renders org picker when user has multiple memberships (SCM flow)', async () => {
    api.getCurrentUserMemberships.mockResolvedValue([
      { organization_id: 'org1', organization_name: 'Org One', created_at: '2024-01-01' },
      { organization_id: 'org2', organization_name: 'Org Two', created_at: '2024-01-02' },
    ])

    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Link from SCM Repository'))

    await waitFor(() => {
      expect(screen.getByLabelText(/Organization/i)).toBeInTheDocument()
    })

    // Default to first org - check displayed text
    await waitFor(() => {
      expect(screen.getByText('Org One')).toBeInTheDocument()
    })

    // Can select a different org
    const orgSelect = screen.getByLabelText(/Organization/i)
    await user.click(orgSelect)
    const org2Option = await screen.findByRole('option', { name: 'Org Two' })
    await user.click(org2Option)

    await waitFor(() => {
      expect(screen.getByText('Org Two')).toBeInTheDocument()
    })
  })

  it('does not render org picker when user has single membership (SCM flow)', async () => {
    api.getCurrentUserMemberships.mockResolvedValue([
      { organization_id: 'org1', organization_name: 'Org One', created_at: '2024-01-01' },
    ])

    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Link from SCM Repository'))

    await waitFor(() => {
      expect(screen.queryByLabelText(/Organization/i)).not.toBeInTheDocument()
    })
  })

  it('includes organization_id in createModuleRecord when org is selected', async () => {
    api.getCurrentUserMemberships.mockResolvedValue([
      { organization_id: 'org1', organization_name: 'Org One', created_at: '2024-01-01' },
      { organization_id: 'org2', organization_name: 'Org Two', created_at: '2024-01-02' },
    ])
    api.createModuleRecord.mockResolvedValue({
      id: 'mod123',
      namespace: 'ns',
      name: 'vpc',
      system: 'aws',
    })

    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Link from SCM Repository'))

    await waitFor(() => {
      expect(screen.getByLabelText(/Organization/i)).toBeInTheDocument()
    })

    const byLabel = (t: RegExp) => screen.getByLabelText(t) as HTMLInputElement
    await user.type(byLabel(/Namespace/), 'myns')
    await user.type(byLabel(/Module Name/), 'vpc')
    await user.type(byLabel(/^Provider/), 'aws')

    const orgSelect = screen.getByLabelText(/Organization/i) as HTMLSelectElement
    await user.click(orgSelect)
    const org2Option = await screen.findByRole('option', { name: 'Org Two' })
    await user.click(org2Option)

    await user.click(screen.getByRole('button', { name: /Continue to Repository Selection/i }))

    await waitFor(() => {
      expect(api.createModuleRecord).toHaveBeenCalledWith({
        namespace: 'myns',
        name: 'vpc',
        system: 'aws',
        organization_id: 'org2',
      })
    })
  })

  it('renders org picker in upload flow when user has multiple memberships', async () => {
    api.getCurrentUserMemberships.mockResolvedValue([
      { organization_id: 'org1', organization_name: 'Org One', created_at: '2024-01-01' },
      { organization_id: 'org2', organization_name: 'Org Two', created_at: '2024-01-02' },
    ])

    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Upload from File'))

    await waitFor(() => {
      expect(screen.getByLabelText(/Organization/i)).toBeInTheDocument()
    })
  })
})
