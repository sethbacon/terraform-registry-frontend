import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ProviderDocsSidebar from '../ProviderDocsSidebar'

describe('ProviderDocsSidebar', () => {
  const defaultProps = {
    providerName: 'aws',
    docs: [] as Array<{ title: string; slug: string; category: string; subcategory?: string }>,
    onSelect: vi.fn(),
    loading: false,
  }

  it('shows loading text when loading', () => {
    render(<ProviderDocsSidebar {...defaultProps} loading={true} />)
    expect(screen.getByText(/loading documentation/i)).toBeInTheDocument()
  })

  it('shows "No documentation available" when docs list is empty', () => {
    render(<ProviderDocsSidebar {...defaultProps} docs={[]} />)
    expect(screen.getByText(/no documentation available/i)).toBeInTheDocument()
  })

  it('renders docs when provided', () => {
    const docs = [
      { title: 'Overview', slug: 'index', category: 'overview' },
      { title: 'Getting Started', slug: 'getting-started', category: 'guides' },
    ]
    render(<ProviderDocsSidebar {...defaultProps} docs={docs} />)
    // The component renders provider name for index slug in overview section
    expect(screen.getByText('aws')).toBeInTheDocument()
  })

  it('renders filter text field', () => {
    const docs = [
      { title: 'Instance Resource', slug: 'instance', category: 'resources', subcategory: 'ec2' },
    ]
    render(<ProviderDocsSidebar {...defaultProps} docs={docs} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })
})
