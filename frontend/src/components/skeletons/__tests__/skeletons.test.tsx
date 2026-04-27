import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RegistryItemCardSkeleton, { RegistryItemGridSkeleton } from '../RegistryItemCardSkeleton'
import DetailPageSkeleton from '../DetailPageSkeleton'

describe('skeletons', () => {
  it('renders a single registry item card skeleton', () => {
    render(<RegistryItemCardSkeleton />)
    expect(screen.getByTestId('registry-item-card-skeleton')).toBeInTheDocument()
  })

  it('renders a grid of skeletons at the requested count', () => {
    render(<RegistryItemGridSkeleton count={4} />)
    expect(screen.getByTestId('registry-item-grid-skeleton')).toBeInTheDocument()
    expect(screen.getAllByTestId('registry-item-card-skeleton')).toHaveLength(4)
  })

  it('defaults to 12 skeletons', () => {
    render(<RegistryItemGridSkeleton />)
    expect(screen.getAllByTestId('registry-item-card-skeleton')).toHaveLength(12)
  })

  it('renders the detail page skeleton', () => {
    render(<DetailPageSkeleton />)
    expect(screen.getByTestId('detail-page-skeleton')).toBeInTheDocument()
  })
})
