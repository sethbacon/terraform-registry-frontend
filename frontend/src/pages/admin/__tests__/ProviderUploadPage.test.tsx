import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CanceledError } from 'axios'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const uploadProviderMock = vi.fn()
vi.mock('../../../services/api', () => ({
  default: {
    uploadProvider: (...args: unknown[]) => uploadProviderMock(...args),
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

  it('enables upload button after file is selected and uploads provider', async () => {
    const user = userEvent.setup()
    uploadProviderMock.mockResolvedValue({})
    renderPage()
    await user.click(screen.getByText('Manual Upload'))

    await user.type(screen.getByLabelText(/Namespace/), 'myorg')
    await user.type(screen.getByLabelText(/Provider Name/), 'widget')
    await user.type(screen.getByLabelText(/Version/), '1.0.0')

    const combos = screen.getAllByRole('combobox')
    await user.click(combos[0])
    await user.click(await screen.findByRole('option', { name: /^Linux$/i }))
    await user.click(combos[1])
    await user.click(await screen.findByRole('option', { name: /AMD64/i }))

    // Simulate file selection via the hidden input in FileDropZone
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['zipdata'], 'terraform-provider-widget_1.0.0_linux_amd64.zip', {
      type: 'application/zip',
    })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /^upload provider$/i })
      expect(btn).not.toBeDisabled()
    })

    await user.click(screen.getByRole('button', { name: /^upload provider$/i }))
    await waitFor(() => expect(uploadProviderMock).toHaveBeenCalled())
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/providers/myorg/widget'))
  })

  it('accepts a 150MB provider archive the backend would have taken (#672)', async () => {
    // FileDropZone's default cap is the module archive limit (100MB). The
    // provider endpoint enforces MaxProviderBinarySize (500MB), and a release
    // zip carrying several platform binaries routinely lands between the two,
    // so before #672 this file was refused in the browser and the request the
    // backend would have accepted was never sent.
    //
    // Asserted through the page rather than by rendering FileDropZone with a
    // prop: the component test cannot tell whether *this page* passes it.
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Manual Upload'))

    const input = screen.getByTestId('provider-upload-dropzone-input') as HTMLInputElement
    const name = 'terraform-provider-widget_1.0.0_linux_amd64.zip'
    const big = new File(['zipdata'], name, { type: 'application/zip' })
    Object.defineProperty(big, 'size', { value: 150 * 1024 * 1024 })
    fireEvent.change(input, { target: { files: [big] } })

    expect(await screen.findByText(name)).toBeInTheDocument()
    expect(screen.queryByTestId('provider-upload-dropzone-error')).not.toBeInTheDocument()
  })

  it('shows error alert when upload fails', async () => {
    const user = userEvent.setup()
    uploadProviderMock.mockRejectedValue(new Error('upload blew up'))
    renderPage()
    await user.click(screen.getByText('Manual Upload'))

    await user.type(screen.getByLabelText(/Namespace/), 'myorg')
    await user.type(screen.getByLabelText(/Provider Name/), 'widget')
    await user.type(screen.getByLabelText(/Version/), '1.0.0')

    const combos = screen.getAllByRole('combobox')
    await user.click(combos[0])
    await user.click(await screen.findByRole('option', { name: /^Linux$/i }))
    await user.click(combos[1])
    await user.click(await screen.findByRole('option', { name: /AMD64/i }))

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'terraform-provider-widget_1.0.0_linux_amd64.zip', {
      type: 'application/zip',
    })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^upload provider$/i })).not.toBeDisabled(),
    )
    await user.click(screen.getByRole('button', { name: /^upload provider$/i }))
    await waitFor(() => expect(screen.getByText(/upload blew up/)).toBeInTheDocument())
  })

  it('shows a Cancel button during upload that aborts without surfacing an error (#602)', async () => {
    const user = userEvent.setup()
    // Stalled upload: never resolves on its own, only rejects when aborted.
    uploadProviderMock.mockImplementationOnce(
      (_fd: FormData, opts?: { onUploadProgress?: (p: number) => void; signal?: AbortSignal }) => {
        opts?.onUploadProgress?.(20)
        return new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener('abort', () => reject(new CanceledError('canceled')))
        })
      },
    )
    renderPage()
    await user.click(screen.getByText('Manual Upload'))

    await user.type(screen.getByLabelText(/Namespace/), 'myorg')
    await user.type(screen.getByLabelText(/Provider Name/), 'widget')
    await user.type(screen.getByLabelText(/Version/), '1.0.0')

    const combos = screen.getAllByRole('combobox')
    await user.click(combos[0])
    await user.click(await screen.findByRole('option', { name: /^Linux$/i }))
    await user.click(combos[1])
    await user.click(await screen.findByRole('option', { name: /AMD64/i }))

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'terraform-provider-widget_1.0.0_linux_amd64.zip', {
      type: 'application/zip',
    })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^upload provider$/i })).not.toBeDisabled(),
    )
    await user.click(screen.getByRole('button', { name: /^upload provider$/i }))

    // Cancel affordance appears while the upload is in flight.
    const cancelBtn = await screen.findByRole('button', { name: /^Cancel$/i })
    await user.click(cancelBtn)

    // Cancelling resets to idle silently — no error alert, no navigation.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Cancel$/i })).not.toBeInTheDocument()
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('aborts an in-flight upload when the component unmounts mid-upload (#602)', async () => {
    const user = userEvent.setup()
    let capturedSignal: AbortSignal | undefined
    // Stalled upload: never resolves on its own, only rejects when aborted.
    uploadProviderMock.mockImplementationOnce(
      (_fd: FormData, opts?: { onUploadProgress?: (p: number) => void; signal?: AbortSignal }) => {
        capturedSignal = opts?.signal
        opts?.onUploadProgress?.(20)
        return new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener('abort', () => reject(new CanceledError('canceled')))
        })
      },
    )
    const { unmount } = renderPage()
    await user.click(screen.getByText('Manual Upload'))

    await user.type(screen.getByLabelText(/Namespace/), 'myorg')
    await user.type(screen.getByLabelText(/Provider Name/), 'widget')
    await user.type(screen.getByLabelText(/Version/), '1.0.0')

    const combos = screen.getAllByRole('combobox')
    await user.click(combos[0])
    await user.click(await screen.findByRole('option', { name: /^Linux$/i }))
    await user.click(combos[1])
    await user.click(await screen.findByRole('option', { name: /AMD64/i }))

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'terraform-provider-widget_1.0.0_linux_amd64.zip', {
      type: 'application/zip',
    })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^upload provider$/i })).not.toBeDisabled(),
    )
    await user.click(screen.getByRole('button', { name: /^upload provider$/i }))

    // Signal is live while the upload is in flight...
    await waitFor(() => expect(capturedSignal).toBeDefined())
    expect(capturedSignal?.aborted).toBe(false)

    // ...and unmounting (e.g. the user navigates away) aborts it.
    unmount()
    expect(capturedSignal?.aborted).toBe(true)
  })

  it('shows validation error when required fields are missing', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Manual Upload'))
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'terraform-provider-w_1.0.0_linux_amd64.zip', {
      type: 'application/zip',
    })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^upload provider$/i })).not.toBeDisabled(),
    )
    await user.click(screen.getByRole('button', { name: /^upload provider$/i }))
    await waitFor(() =>
      expect(screen.getByText(/Please fill in all required fields/)).toBeInTheDocument(),
    )
  })
})
