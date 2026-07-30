import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ProviderVersionDetailsPanel from '../ProviderVersionDetailsPanel'
import type { ProviderVersion } from '../../types'

function makeVersion(overrides: Partial<ProviderVersion> = {}): ProviderVersion {
  return {
    id: 'v-1',
    provider_id: 'p-1',
    version: '5.0.0',
    protocols: ['6.0'],
    published_at: '2025-06-01T00:00:00Z',
    created_at: '2025-06-01T00:00:00Z',
    download_count: 100,
    deprecated: false,
    ...overrides,
  } as ProviderVersion
}

describe('ProviderVersionDetailsPanel', () => {
  const defaultProps = {
    canManage: false,
    deprecating: false,
    onUndeprecate: vi.fn(),
    onOpenDeprecateDialog: vi.fn(),
    onOpenDeleteVersionDialog: vi.fn(),
  }

  it('returns null when no version is selected', () => {
    const { container } = render(
      <ProviderVersionDetailsPanel {...defaultProps} selectedVersion={null} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders the version heading, publish date and downloads', () => {
    render(<ProviderVersionDetailsPanel {...defaultProps} selectedVersion={makeVersion()} />)
    expect(screen.getByText('Version 5.0.0 Details')).toBeInTheDocument()
    expect(screen.getByText('Published:').parentElement).toHaveTextContent('2025-06-01')
    expect(screen.getByText('Downloads:').parentElement).toHaveTextContent('100')
  })

  it('hides manage actions when the user cannot manage', () => {
    render(<ProviderVersionDetailsPanel {...defaultProps} selectedVersion={makeVersion()} />)
    expect(screen.queryByRole('button', { name: /deprecate version/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete this version/i })).not.toBeInTheDocument()
  })

  it('opens the deprecate dialog from the manage actions', async () => {
    const onOpenDeprecateDialog = vi.fn()
    render(
      <ProviderVersionDetailsPanel
        {...defaultProps}
        canManage
        onOpenDeprecateDialog={onOpenDeprecateDialog}
        selectedVersion={makeVersion()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /deprecate version/i }))
    expect(onOpenDeprecateDialog).toHaveBeenCalled()
  })

  it('passes the version to the delete-version handler', async () => {
    const onOpenDeleteVersionDialog = vi.fn()
    render(
      <ProviderVersionDetailsPanel
        {...defaultProps}
        canManage
        onOpenDeleteVersionDialog={onOpenDeleteVersionDialog}
        selectedVersion={makeVersion()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /delete this version/i }))
    expect(onOpenDeleteVersionDialog).toHaveBeenCalledWith('5.0.0')
  })

  it('renders the deprecation notice and offers to remove it', async () => {
    const onUndeprecate = vi.fn()
    render(
      <ProviderVersionDetailsPanel
        {...defaultProps}
        canManage
        onUndeprecate={onUndeprecate}
        selectedVersion={makeVersion({
          deprecated: true,
          deprecated_at: '2025-07-01T00:00:00Z',
          deprecation_message: 'Please upgrade to 6.x',
        })}
      />,
    )
    expect(screen.getByText('Please upgrade to 6.x')).toBeInTheDocument()
    expect(screen.getByText('Deprecated').parentElement).toHaveTextContent('on 2025-07-01')
    await userEvent.click(screen.getByRole('button', { name: /remove deprecation/i }))
    expect(onUndeprecate).toHaveBeenCalled()
  })

  it('disables the undeprecate button while a deprecation call is in flight', () => {
    render(
      <ProviderVersionDetailsPanel
        {...defaultProps}
        canManage
        deprecating
        selectedVersion={makeVersion({ deprecated: true })}
      />,
    )
    expect(screen.getByRole('button', { name: /removing/i })).toBeDisabled()
  })
})
