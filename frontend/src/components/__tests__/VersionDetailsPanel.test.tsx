import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import VersionDetailsPanel from '../VersionDetailsPanel'
import type { ModuleVersion } from '../../types'

function makeVersion(overrides: Partial<ModuleVersion> = {}): ModuleVersion {
  return {
    id: 'v-1',
    version: '1.0.0',
    namespace: 'hashicorp',
    name: 'consul',
    system: 'aws',
    download_count: 42,
    published_at: '2025-01-15T10:00:00Z',
    created_at: '2025-01-15T10:00:00Z',
    deprecated: false,
    ...overrides,
  } as ModuleVersion
}

describe('VersionDetailsPanel', () => {
  const defaultProps = {
    canManage: false,
    deprecating: false,
    onUndeprecate: vi.fn(),
    onOpenDeprecateDialog: vi.fn(),
    onOpenDeleteVersionDialog: vi.fn(),
  }

  it('returns null when selectedVersion is null', () => {
    const { container } = render(
      <VersionDetailsPanel {...defaultProps} selectedVersion={null} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders version number heading', () => {
    render(
      <VersionDetailsPanel {...defaultProps} selectedVersion={makeVersion()} />
    )
    expect(screen.getByText('Version 1.0.0 Details')).toBeInTheDocument()
  })

  it('renders published date', () => {
    render(
      <VersionDetailsPanel {...defaultProps} selectedVersion={makeVersion()} />
    )
    // Should contain a date string
    expect(screen.getByText(/Published:/)).toBeInTheDocument()
  })

  it('renders download count', () => {
    render(
      <VersionDetailsPanel {...defaultProps} selectedVersion={makeVersion({ download_count: 100 })} />
    )
    expect(screen.getByText(/100/)).toBeInTheDocument()
  })

  it('renders N/A when no published date', () => {
    render(
      <VersionDetailsPanel
        {...defaultProps}
        selectedVersion={makeVersion({ published_at: undefined, created_at: undefined })}
      />
    )
    expect(screen.getByText(/N\/A/)).toBeInTheDocument()
  })

  it('renders published_by_name when present', () => {
    render(
      <VersionDetailsPanel
        {...defaultProps}
        selectedVersion={makeVersion({ published_by_name: 'John Doe' })}
      />
    )
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('shows deprecation alert when deprecated', () => {
    render(
      <VersionDetailsPanel
        {...defaultProps}
        selectedVersion={makeVersion({
          deprecated: true,
          deprecated_at: '2025-06-01T00:00:00Z',
          deprecation_message: 'Use v2 instead',
        })}
      />
    )
    expect(screen.getByText(/Deprecated/)).toBeInTheDocument()
    expect(screen.getByText('Use v2 instead')).toBeInTheDocument()
  })

  it('shows deprecate button when canManage and not deprecated', () => {
    render(
      <VersionDetailsPanel
        {...defaultProps}
        canManage={true}
        selectedVersion={makeVersion()}
      />
    )
    expect(screen.getByText('Deprecate Version')).toBeInTheDocument()
  })

  it('shows undeprecate button when canManage and deprecated', () => {
    render(
      <VersionDetailsPanel
        {...defaultProps}
        canManage={true}
        selectedVersion={makeVersion({ deprecated: true })}
      />
    )
    expect(screen.getByText('Remove Deprecation')).toBeInTheDocument()
  })

  it('shows "Removing Deprecation..." when deprecating in progress', () => {
    render(
      <VersionDetailsPanel
        {...defaultProps}
        canManage={true}
        deprecating={true}
        selectedVersion={makeVersion({ deprecated: true })}
      />
    )
    expect(screen.getByText('Removing Deprecation...')).toBeInTheDocument()
  })

  it('shows delete button when canManage', () => {
    render(
      <VersionDetailsPanel
        {...defaultProps}
        canManage={true}
        selectedVersion={makeVersion()}
      />
    )
    expect(screen.getByText('Delete This Version')).toBeInTheDocument()
  })

  it('hides manage buttons when canManage is false', () => {
    render(
      <VersionDetailsPanel {...defaultProps} selectedVersion={makeVersion()} />
    )
    expect(screen.queryByText('Deprecate Version')).not.toBeInTheDocument()
    expect(screen.queryByText('Delete This Version')).not.toBeInTheDocument()
  })

  it('calls onOpenDeprecateDialog when deprecate is clicked', async () => {
    const onOpenDeprecateDialog = vi.fn()
    const user = userEvent.setup()
    render(
      <VersionDetailsPanel
        {...defaultProps}
        canManage={true}
        onOpenDeprecateDialog={onOpenDeprecateDialog}
        selectedVersion={makeVersion()}
      />
    )
    await user.click(screen.getByText('Deprecate Version'))
    expect(onOpenDeprecateDialog).toHaveBeenCalled()
  })

  it('calls onOpenDeleteVersionDialog with version when delete is clicked', async () => {
    const onOpenDeleteVersionDialog = vi.fn()
    const user = userEvent.setup()
    render(
      <VersionDetailsPanel
        {...defaultProps}
        canManage={true}
        onOpenDeleteVersionDialog={onOpenDeleteVersionDialog}
        selectedVersion={makeVersion({ version: '2.0.0' })}
      />
    )
    await user.click(screen.getByText('Delete This Version'))
    expect(onOpenDeleteVersionDialog).toHaveBeenCalledWith('2.0.0')
  })

  it('calls onUndeprecate when remove deprecation is clicked', async () => {
    const onUndeprecate = vi.fn()
    const user = userEvent.setup()
    render(
      <VersionDetailsPanel
        {...defaultProps}
        canManage={true}
        onUndeprecate={onUndeprecate}
        selectedVersion={makeVersion({ deprecated: true })}
      />
    )
    await user.click(screen.getByText('Remove Deprecation'))
    expect(onUndeprecate).toHaveBeenCalled()
  })
})
