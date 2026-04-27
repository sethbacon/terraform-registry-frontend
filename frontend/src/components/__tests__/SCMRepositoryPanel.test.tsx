import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import SCMRepositoryPanel from '../SCMRepositoryPanel'
import type { ModuleSCMLink } from '../../types/scm'

const defaultLink: ModuleSCMLink = {
  id: 'link-1',
  module_id: 'mod-1',
  provider_id: 'scm-1',
  repository_owner: 'myorg',
  repository_name: 'terraform-vpc',
  default_branch: 'main',
  tag_pattern: 'v*',
  auto_publish_enabled: true,
  webhook_secret: '',
  last_sync_at: '2025-06-01T12:00:00Z',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-06-01T12:00:00Z',
}

const defaultProps = {
  isAuthenticated: true,
  scmLinkLoaded: true,
  scmLink: defaultLink,
  scmSyncing: false,
  scmUnlinking: false,
  onSync: vi.fn(),
  onUnlink: vi.fn(),
  onOpenWizard: vi.fn(),
}

describe('SCMRepositoryPanel', () => {
  it('returns null when not authenticated', () => {
    const { container } = render(<SCMRepositoryPanel {...defaultProps} isAuthenticated={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when scm link not loaded', () => {
    const { container } = render(<SCMRepositoryPanel {...defaultProps} scmLinkLoaded={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders repository info when linked', () => {
    render(<SCMRepositoryPanel {...defaultProps} />)
    expect(screen.getByText('Source Repository')).toBeInTheDocument()
    expect(screen.getByText('myorg/terraform-vpc')).toBeInTheDocument()
    expect(screen.getByText(/Branch: main/)).toBeInTheDocument()
    expect(screen.getByText('Auto-publish on')).toBeInTheDocument()
  })

  it('shows auto-publish off chip', () => {
    render(
      <SCMRepositoryPanel
        {...defaultProps}
        scmLink={{ ...defaultLink, auto_publish_enabled: false }}
      />,
    )
    expect(screen.getByText('Auto-publish off')).toBeInTheDocument()
  })

  it('shows Sync Now button', () => {
    render(<SCMRepositoryPanel {...defaultProps} />)
    expect(screen.getByText('Sync Now')).toBeInTheDocument()
  })

  it('shows Syncing... when syncing', () => {
    render(<SCMRepositoryPanel {...defaultProps} scmSyncing={true} />)
    expect(screen.getByText('Syncing...')).toBeInTheDocument()
  })

  it('shows Unlink Repository button', () => {
    render(<SCMRepositoryPanel {...defaultProps} />)
    expect(screen.getByText('Unlink Repository')).toBeInTheDocument()
  })

  it('shows Unlinking... when unlinking', () => {
    render(<SCMRepositoryPanel {...defaultProps} scmUnlinking={true} />)
    expect(screen.getByText('Unlinking...')).toBeInTheDocument()
  })

  it('calls onSync when sync button clicked', async () => {
    const onSync = vi.fn()
    const user = userEvent.setup()
    render(<SCMRepositoryPanel {...defaultProps} onSync={onSync} />)
    await user.click(screen.getByText('Sync Now'))
    expect(onSync).toHaveBeenCalled()
  })

  it('shows Link Repository when no scmLink', () => {
    render(<SCMRepositoryPanel {...defaultProps} scmLink={null} />)
    expect(screen.getByText('Link Repository')).toBeInTheDocument()
    expect(screen.getByText(/Not linked to a repository/)).toBeInTheDocument()
  })

  it('calls onOpenWizard when Link Repository is clicked', async () => {
    const onOpenWizard = vi.fn()
    const user = userEvent.setup()
    render(<SCMRepositoryPanel {...defaultProps} scmLink={null} onOpenWizard={onOpenWizard} />)
    await user.click(screen.getByText('Link Repository'))
    expect(onOpenWizard).toHaveBeenCalled()
  })
})
