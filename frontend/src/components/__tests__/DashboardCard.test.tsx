import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardCard from '../DashboardCard'

describe('DashboardCard', () => {
  it('renders the label and value', () => {
    render(<DashboardCard label="Modules" value={18} />)
    expect(screen.getByText('Modules')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
  })

  it('becomes a link when given a route', () => {
    render(
      <MemoryRouter>
        <DashboardCard label="Modules" value={3} to="/modules" />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/modules')
  })

  it('is not clickable without a route', () => {
    render(<DashboardCard label="Modules" value={3} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
