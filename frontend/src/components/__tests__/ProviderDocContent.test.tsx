import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getProviderDocContentMock = vi.fn()
vi.mock('../../services/api', () => ({
  default: {
    getProviderDocContent: (...args: unknown[]) => getProviderDocContentMock(...args),
  },
}))

vi.mock('../MarkdownRenderer', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}))

import ProviderDocContent from '../ProviderDocContent'

describe('ProviderDocContent', () => {
  const defaultProps = {
    namespace: 'hashicorp',
    type: 'aws',
    version: '5.0.0',
    category: 'resources',
    slug: 'aws_instance',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner initially', () => {
    getProviderDocContentMock.mockReturnValue(new Promise(() => {}))
    render(<ProviderDocContent {...defaultProps} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders content after load', async () => {
    getProviderDocContentMock.mockResolvedValue({
      content: '# AWS Instance\n\nManages an EC2 instance.',
    })
    render(<ProviderDocContent {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByTestId('markdown')).toHaveTextContent('# AWS Instance')
    })
  })

  it('strips frontmatter from content', async () => {
    getProviderDocContentMock.mockResolvedValue({
      content: '---\ntitle: AWS Instance\n---\n# AWS Instance\n\nBody content.',
    })
    render(<ProviderDocContent {...defaultProps} />)
    await waitFor(() => {
      const md = screen.getByTestId('markdown')
      expect(md.textContent).not.toContain('title: AWS Instance')
      expect(md.textContent).toContain('# AWS Instance')
    })
  })

  it('shows error on API failure', async () => {
    getProviderDocContentMock.mockRejectedValue(new Error('Not found'))
    render(<ProviderDocContent {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Failed to load documentation.')).toBeInTheDocument()
    })
  })

  it('handles content without frontmatter', async () => {
    getProviderDocContentMock.mockResolvedValue({
      content: 'Plain markdown content.',
    })
    render(<ProviderDocContent {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByTestId('markdown')).toHaveTextContent('Plain markdown content.')
    })
  })
})
