import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import PageHeader from '../PageHeader'

describe('PageHeader', () => {
  it('renders the title as the page h1', () => {
    render(<PageHeader title="Modules" />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('Modules')
  })

  it('renders an optional description', () => {
    render(<PageHeader title="T" description="Browse and publish modules" />)
    expect(screen.getByText('Browse and publish modules')).toBeInTheDocument()
  })

  it('renders right-aligned actions when provided', () => {
    render(<PageHeader title="T" actions={<button>Upload module</button>} />)
    expect(screen.getByRole('button', { name: 'Upload module' })).toBeInTheDocument()
  })

  it('renders an optional leading icon beside the title', () => {
    render(<PageHeader title="Modules" icon={<svg data-testid="page-icon" />} />)
    expect(screen.getByTestId('page-icon')).toBeInTheDocument()
  })

  it('omits the description node when not provided', () => {
    render(<PageHeader title="T" />)
    expect(screen.queryByText('Browse and publish modules')).not.toBeInTheDocument()
  })
})
