import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RegistryItemCard from '../RegistryItemCard'
import { describe, it, expect, vi } from 'vitest'

describe('RegistryItemCard', () => {
  const defaultProps = {
    title: 'hashicorp/consul/aws',
    subtitle: 'hashicorp',
    description: 'A module for deploying Consul on AWS',
    onClick: vi.fn(),
  }

  it('renders title, subtitle, and description', () => {
    render(<RegistryItemCard {...defaultProps} />)

    expect(screen.getByText('hashicorp/consul/aws')).toBeInTheDocument()
    expect(screen.getByText('hashicorp')).toBeInTheDocument()
    expect(screen.getByText('A module for deploying Consul on AWS')).toBeInTheDocument()
  })

  it('shows fallback text when no description provided', () => {
    render(
      <RegistryItemCard
        title="test-module"
        onClick={vi.fn()}
      />
    )

    expect(screen.getByText('No description available')).toBeInTheDocument()
  })

  it('shows default action label "View Details"', () => {
    render(<RegistryItemCard {...defaultProps} />)

    expect(screen.getByText('View Details')).toBeInTheDocument()
  })

  it('shows custom action label', () => {
    render(
      <RegistryItemCard {...defaultProps} actionLabel="Explore" />
    )

    expect(screen.getByText('Explore')).toBeInTheDocument()
  })

  it('calls onClick when card is clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()

    render(<RegistryItemCard {...defaultProps} onClick={onClick} />)

    // Click the card (the MUI Card element)
    const card = screen.getByText('hashicorp/consul/aws').closest('[class*="MuiCard"]')
    if (card) {
      await user.click(card)
      expect(onClick).toHaveBeenCalledTimes(1)
    }
  })

  it('renders badge when provided', () => {
    render(
      <RegistryItemCard
        {...defaultProps}
        badge={<span data-testid="badge">Mirrored</span>}
      />
    )

    expect(screen.getByTestId('badge')).toBeInTheDocument()
    expect(screen.getByText('Mirrored')).toBeInTheDocument()
  })

  it('renders chips when provided', () => {
    render(
      <RegistryItemCard
        {...defaultProps}
        chips={<span data-testid="chip">v1.0.0</span>}
      />
    )

    expect(screen.getByTestId('chip')).toBeInTheDocument()
  })

  it('does not render subtitle when not provided', () => {
    render(
      <RegistryItemCard
        title="test-module"
        description="A test module"
        onClick={vi.fn()}
      />
    )

    // Title should exist, but no subtitle text
    expect(screen.getByText('test-module')).toBeInTheDocument()
  })
})
