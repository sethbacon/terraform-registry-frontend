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

  // Every test above mocks MarkdownRenderer to a plain <div>, so none of them exercise
  // the real sanitizer. Only the isolated MarkdownRenderer unit test does -- a future
  // change to this fetch-to-render path (e.g. swapping in a different renderer, or
  // adding rehype-raw) could bypass sanitization with no test catching it end-to-end.
  // Use the REAL MarkdownRenderer here, through a fresh module instance, to prove the
  // full ProviderDocContent pipeline (fetch -> strip frontmatter -> render) sanitizes
  // attacker-controlled README content, not just the isolated component.
  //
  // Payload uses markdown link/image syntax, not raw <script>/<img onerror> HTML:
  // this component has no rehype-raw plugin, so react-markdown never renders raw HTML
  // nodes at all (verified: they produce zero DOM elements, not sanitized-and-kept
  // ones) -- raw HTML injection is a non-issue here by construction. The reachable
  // attack surface is a dangerous protocol in a real markdown link/image URL.
  describe('end-to-end sanitization (real MarkdownRenderer, not mocked)', () => {
    it('strips javascript: and data: URIs from fetched README content', async () => {
      vi.resetModules()
      vi.doUnmock('../MarkdownRenderer')
      vi.doMock('../../services/api', () => ({
        default: { getProviderDocContent: getProviderDocContentMock },
      }))
      getProviderDocContentMock.mockResolvedValue({
        content:
          '[click me](javascript:alert(1))\n\n![alt text](javascript:alert(1))\n\n[data payload](data:text/html,<script>alert(1)</script>)',
      })

      const { default: RealProviderDocContent } = await import('../ProviderDocContent')
      const { container } = render(<RealProviderDocContent {...defaultProps} />)

      await waitFor(() => {
        expect(container.querySelectorAll('a, img').length).toBeGreaterThan(0)
      })
      container.querySelectorAll('a').forEach((a) => {
        expect(a.getAttribute('href')).toBeNull()
      })
      container.querySelectorAll('img').forEach((img) => {
        expect(img.getAttribute('src')).toBeNull()
      })
    })
  })
})
