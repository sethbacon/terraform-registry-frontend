import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import FileDropZone, { HARD_MAX_BYTES, PROVIDER_MAX_BYTES, SOFT_WARN_BYTES } from '../FileDropZone'

function makeFile(name: string, sizeBytes: number, type = 'application/gzip'): File {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: sizeBytes })
  return f
}

function makeDataTransfer(files: File[]): DataTransfer {
  return {
    files: files as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: ['Files'],
  } as unknown as DataTransfer
}

describe('FileDropZone', () => {
  const accepted = ['.tar.gz', '.tgz']

  it('renders idle prompt by default', () => {
    render(<FileDropZone file={null} onFileSelected={vi.fn()} acceptedExtensions={accepted} />)
    expect(screen.getByTestId('file-drop-zone')).toBeInTheDocument()
    expect(
      screen.getByText(/Drop \.tar\.gz \/ \.tgz file here or click to browse/i),
    ).toBeInTheDocument()
  })

  it('highlights on dragover and clears on dragleave', () => {
    render(<FileDropZone file={null} onFileSelected={vi.fn()} acceptedExtensions={accepted} />)
    const zone = screen.getByTestId('file-drop-zone')
    fireEvent.dragOver(zone)
    // dragOver styling is applied; just verify no crash and element still exists
    expect(zone).toBeInTheDocument()
    fireEvent.dragLeave(zone)
    expect(zone).toBeInTheDocument()
  })

  it('invokes onFileSelected when a valid file is dropped', () => {
    const onFileSelected = vi.fn()
    render(
      <FileDropZone file={null} onFileSelected={onFileSelected} acceptedExtensions={accepted} />,
    )
    const zone = screen.getByTestId('file-drop-zone')
    const file = makeFile('my-module.tar.gz', 1024)
    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) })
    expect(onFileSelected).toHaveBeenCalledWith(file)
  })

  it('rejects invalid extensions and surfaces an error', () => {
    const onFileSelected = vi.fn()
    render(
      <FileDropZone file={null} onFileSelected={onFileSelected} acceptedExtensions={accepted} />,
    )
    const zone = screen.getByTestId('file-drop-zone')
    const bad = makeFile('not-a-module.zip', 1024)
    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([bad]) })
    expect(onFileSelected).not.toHaveBeenCalled()
    expect(screen.getByTestId('file-drop-zone-error')).toHaveTextContent(/Invalid file type/i)
  })

  it('blocks files larger than the hard maximum', () => {
    const onFileSelected = vi.fn()
    render(
      <FileDropZone file={null} onFileSelected={onFileSelected} acceptedExtensions={accepted} />,
    )
    const zone = screen.getByTestId('file-drop-zone')
    const huge = makeFile('huge.tar.gz', HARD_MAX_BYTES + 1)
    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([huge]) })
    expect(onFileSelected).not.toHaveBeenCalled()
    expect(screen.getByTestId('file-drop-zone-error')).toHaveTextContent(/too large/i)
  })

  it('accepts a file above the default cap when maxBytes raises it (#672)', () => {
    // The provider case. A 150MB archive is well inside what the backend
    // accepts for providers (MaxProviderBinarySize, 500MB) but was refused in
    // the browser because the component's single constant was the module limit.
    const onFileSelected = vi.fn()
    render(
      <FileDropZone
        file={null}
        onFileSelected={onFileSelected}
        acceptedExtensions={['.zip']}
        maxBytes={PROVIDER_MAX_BYTES}
      />,
    )
    const zone = screen.getByTestId('file-drop-zone')
    const big = makeFile('terraform-provider-widget_1.0.0.zip', 150 * 1024 * 1024)
    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([big]) })
    expect(onFileSelected).toHaveBeenCalledWith(big)
    expect(screen.queryByTestId('file-drop-zone-error')).not.toBeInTheDocument()
  })

  it('still blocks a file above the raised cap', () => {
    // maxBytes moves the limit, it does not remove it.
    const onFileSelected = vi.fn()
    render(
      <FileDropZone
        file={null}
        onFileSelected={onFileSelected}
        acceptedExtensions={['.zip']}
        maxBytes={PROVIDER_MAX_BYTES}
      />,
    )
    const zone = screen.getByTestId('file-drop-zone')
    const huge = makeFile('enormous.zip', PROVIDER_MAX_BYTES + 1)
    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([huge]) })
    expect(onFileSelected).not.toHaveBeenCalled()
    expect(screen.getByTestId('file-drop-zone-error')).toHaveTextContent(/500\.0 MB/)
  })

  it('reports the effective cap, not the default, in the idle hint and the error', () => {
    // The advertised maximum and the rejection message both have to follow
    // maxBytes; a zone that accepts 500MB while telling the user "Maximum
    // 100.0 MB" is the same false rejection moved into the copy.
    const { rerender } = render(
      <FileDropZone file={null} onFileSelected={vi.fn()} acceptedExtensions={['.zip']} />,
    )
    expect(screen.getByText(/Maximum 100\.0 MB/)).toBeInTheDocument()

    rerender(
      <FileDropZone
        file={null}
        onFileSelected={vi.fn()}
        acceptedExtensions={['.zip']}
        maxBytes={PROVIDER_MAX_BYTES}
      />,
    )
    expect(screen.getByText(/Maximum 500\.0 MB/)).toBeInTheDocument()

    const zone = screen.getByTestId('file-drop-zone')
    fireEvent.drop(zone, {
      dataTransfer: makeDataTransfer([makeFile('over.zip', PROVIDER_MAX_BYTES + 1)]),
    })
    expect(screen.getByTestId('file-drop-zone-error')).toHaveTextContent(
      'Maximum allowed size is 500.0 MB.',
    )
  })

  it('warns but accepts files between soft and hard limits', () => {
    const onFileSelected = vi.fn()
    render(
      <FileDropZone file={null} onFileSelected={onFileSelected} acceptedExtensions={accepted} />,
    )
    const zone = screen.getByTestId('file-drop-zone')
    const large = makeFile('big.tar.gz', SOFT_WARN_BYTES + 1)
    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([large]) })
    expect(onFileSelected).toHaveBeenCalledWith(large)
    expect(screen.getByTestId('file-drop-zone-warning')).toHaveTextContent(/Large file/i)
  })

  it('triggers the hidden input when the zone is clicked', async () => {
    const user = userEvent.setup()
    const onFileSelected = vi.fn()
    render(
      <FileDropZone file={null} onFileSelected={onFileSelected} acceptedExtensions={accepted} />,
    )
    const zone = screen.getByTestId('file-drop-zone')
    const input = screen.getByTestId('file-drop-zone-input') as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click')
    await user.click(zone)
    expect(clickSpy).toHaveBeenCalled()
  })

  it('shows selected file details and exposes a Replace button', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    const onFileSelected = vi.fn()
    const file = makeFile('ready.tgz', 2048)
    render(
      <FileDropZone
        file={file}
        onFileSelected={onFileSelected}
        onClear={onClear}
        acceptedExtensions={accepted}
      />,
    )
    expect(screen.getByText('ready.tgz')).toBeInTheDocument()
    expect(screen.getByText('2.0 KB')).toBeInTheDocument()
    const replace = screen.getByTestId('file-drop-zone-replace')
    await user.click(replace)
    expect(onClear).toHaveBeenCalled()
  })

  it('ignores drops when disabled', () => {
    const onFileSelected = vi.fn()
    render(
      <FileDropZone
        file={null}
        onFileSelected={onFileSelected}
        acceptedExtensions={accepted}
        disabled
      />,
    )
    const zone = screen.getByTestId('file-drop-zone')
    const file = makeFile('disabled.tar.gz', 1024)
    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) })
    expect(onFileSelected).not.toHaveBeenCalled()
  })
})
