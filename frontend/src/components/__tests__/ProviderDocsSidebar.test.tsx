import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { ProviderDocEntry } from '../../types'
import ProviderDocsSidebar from '../ProviderDocsSidebar'

const doc = (
  overrides: Partial<ProviderDocEntry> & Pick<ProviderDocEntry, 'title' | 'slug' | 'category'>,
): ProviderDocEntry => ({
  id: crypto.randomUUID(),
  language: 'hcl',
  ...overrides,
})

describe('ProviderDocsSidebar', () => {
  const defaultProps = {
    providerName: 'aws',
    docs: [] as ProviderDocEntry[],
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
      doc({ title: 'Overview', slug: 'index', category: 'overview' }),
      doc({ title: 'Getting Started', slug: 'getting-started', category: 'guides' }),
    ]
    render(<ProviderDocsSidebar {...defaultProps} docs={docs} />)
    // The component renders provider name for index slug in overview section
    expect(screen.getByText('aws')).toBeInTheDocument()
  })

  it('renders filter text field', () => {
    const docs = [
      doc({
        title: 'Instance Resource',
        slug: 'instance',
        category: 'resources',
        subcategory: 'ec2',
      }),
    ]
    render(<ProviderDocsSidebar {...defaultProps} docs={docs} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })
})
