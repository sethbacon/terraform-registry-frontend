import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import WebhookEventsPanel from '../WebhookEventsPanel'
import type { ModuleSCMLink, SCMWebhookEvent } from '../../types/scm'

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
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-06-01T00:00:00Z',
}

const fakeEvents: SCMWebhookEvent[] = [
  {
    id: 'evt-1',
    module_source_repo_id: 'link-1',
    event_type: 'tag_push',
    ref_name: 'v1.0.0',
    commit_sha: 'abc123',
    payload: {},
    state: 'succeeded',
    created_at: '2025-06-01T12:00:00Z',
    updated_at: '2025-06-01T12:05:00Z',
  },
  {
    id: 'evt-2',
    module_source_repo_id: 'link-1',
    event_type: 'tag_push',
    ref_name: 'v1.1.0',
    commit_sha: 'def456',
    payload: {},
    state: 'failed',
    error_message: 'Archive extraction failed',
    created_at: '2025-06-02T12:00:00Z',
    updated_at: '2025-06-02T12:01:00Z',
  },
]

const defaultProps = {
  isAuthenticated: true,
  scmLink: defaultLink,
  moduleId: 'mod-1',
  webhookEvents: fakeEvents,
  webhookEventsLoaded: true,
  webhookEventsLoading: false,
  webhookEventsExpanded: true,
  onToggleExpanded: vi.fn(),
  onLoadEvents: vi.fn().mockResolvedValue(undefined),
}

describe('WebhookEventsPanel', () => {
  it('returns null when not authenticated', () => {
    const { container } = render(
      <WebhookEventsPanel {...defaultProps} isAuthenticated={false} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('returns null when no scmLink', () => {
    const { container } = render(
      <WebhookEventsPanel {...defaultProps} scmLink={null} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders webhook events heading', () => {
    render(<WebhookEventsPanel {...defaultProps} />)
    expect(screen.getByText('Webhook Events')).toBeInTheDocument()
  })

  it('renders event list when expanded', () => {
    render(<WebhookEventsPanel {...defaultProps} />)
    expect(screen.getByText(/tag_push — v1.0.0/)).toBeInTheDocument()
    expect(screen.getByText('succeeded')).toBeInTheDocument()
    expect(screen.getByText('failed')).toBeInTheDocument()
  })

  it('shows error message for failed events', () => {
    render(<WebhookEventsPanel {...defaultProps} />)
    expect(screen.getByText('Archive extraction failed')).toBeInTheDocument()
  })

  it('shows empty message when no events', () => {
    render(
      <WebhookEventsPanel {...defaultProps} webhookEvents={[]} />
    )
    expect(screen.getByText('No webhook events recorded yet.')).toBeInTheDocument()
  })

  it('shows loading spinner when loading', () => {
    render(
      <WebhookEventsPanel {...defaultProps} webhookEventsLoading={true} webhookEvents={[]} />
    )
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows Refresh button when loaded', () => {
    render(<WebhookEventsPanel {...defaultProps} />)
    expect(screen.getByText('Refresh')).toBeInTheDocument()
  })

  it('calls onToggleExpanded when header clicked', async () => {
    const onToggleExpanded = vi.fn()
    const user = userEvent.setup()
    render(
      <WebhookEventsPanel {...defaultProps} onToggleExpanded={onToggleExpanded} />
    )
    await user.click(screen.getByText('Webhook Events'))
    expect(onToggleExpanded).toHaveBeenCalled()
  })

  it('toggle button has aria label', () => {
    render(<WebhookEventsPanel {...defaultProps} />)
    expect(screen.getByLabelText('Toggle webhook events')).toBeInTheDocument()
  })
})
