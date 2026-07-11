import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import WebhookEventsPanel from '../WebhookEventsPanel'
import type { ModuleSCMLink, SCMWebhookEvent } from '../../types/scm'

const defaultLink: ModuleSCMLink = {
  id: 'link-1',
  module_id: 'mod-1',
  scm_provider_id: 'scm-1',
  repository_owner: 'myorg',
  repository_name: 'terraform-vpc',
  default_branch: 'main',
  module_path: '',
  tag_pattern: 'v*',
  auto_publish_enabled: true,
  webhook_enabled: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-06-01T00:00:00Z',
}

// Fixtures mirror the real wire shape (backend scm.SCMWebhookEvent): the
// display status is derived from processed/error, not a server `state` field.
const fakeEvents: SCMWebhookEvent[] = [
  {
    id: 'evt-1',
    module_scm_repo_id: 'link-1',
    event_type: 'tag_push',
    tag_name: 'v1.0.0',
    commit_sha: 'abc123',
    payload: {},
    processed: true,
    processed_at: '2025-06-01T12:05:00Z',
    retry_count: 0,
    max_retries: 3,
    created_at: '2025-06-01T12:00:00Z',
  },
  {
    id: 'evt-2',
    module_scm_repo_id: 'link-1',
    event_type: 'tag_push',
    ref: 'refs/tags/v1.1.0',
    // The backend serializes tag_name as "" (never absent) on non-tag events —
    // the display must fall back to ref through an empty string, not just null.
    tag_name: '',
    commit_sha: 'def456',
    payload: {},
    processed: true,
    error: 'Archive extraction failed',
    retry_count: 1,
    max_retries: 3,
    created_at: '2025-06-02T12:00:00Z',
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
    const { container } = render(<WebhookEventsPanel {...defaultProps} isAuthenticated={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when no scmLink', () => {
    const { container } = render(<WebhookEventsPanel {...defaultProps} scmLink={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders webhook events heading', () => {
    render(<WebhookEventsPanel {...defaultProps} />)
    expect(screen.getByText('Webhook Events')).toBeInTheDocument()
  })

  it('renders event list when expanded', () => {
    render(<WebhookEventsPanel {...defaultProps} />)
    expect(screen.getByText(/tag_push — v1.0.0/)).toBeInTheDocument()
    // tag_name wins over ref when both could identify the event
    expect(screen.getByText(/tag_push — refs\/tags\/v1.1.0/)).toBeInTheDocument()
    expect(screen.getByText('succeeded')).toBeInTheDocument()
    // processed with an error must read as failed, not succeeded
    expect(screen.getByText('failed')).toBeInTheDocument()
  })

  it('shows error message for failed events', () => {
    render(<WebhookEventsPanel {...defaultProps} />)
    expect(screen.getByText('Archive extraction failed')).toBeInTheDocument()
  })

  it('shows empty message when no events', () => {
    render(<WebhookEventsPanel {...defaultProps} webhookEvents={[]} />)
    expect(screen.getByText('No webhook events recorded yet.')).toBeInTheDocument()
  })

  it('shows loading spinner when loading', () => {
    render(<WebhookEventsPanel {...defaultProps} webhookEventsLoading={true} webhookEvents={[]} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows Refresh button when loaded', () => {
    render(<WebhookEventsPanel {...defaultProps} />)
    expect(screen.getByText('Refresh')).toBeInTheDocument()
  })

  it('calls onToggleExpanded when header clicked', async () => {
    const onToggleExpanded = vi.fn()
    const user = userEvent.setup()
    render(<WebhookEventsPanel {...defaultProps} onToggleExpanded={onToggleExpanded} />)
    await user.click(screen.getByText('Webhook Events'))
    expect(onToggleExpanded).toHaveBeenCalled()
  })

  it('toggle button has aria label', () => {
    render(<WebhookEventsPanel {...defaultProps} />)
    expect(screen.getByLabelText('Toggle webhook events')).toBeInTheDocument()
  })
})
