import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useNavigationBreadcrumbs', () => ({
  useNavigationBreadcrumbs: vi.fn(),
}))

import NavigationBreadcrumbTracker from '../NavigationBreadcrumbTracker'

describe('NavigationBreadcrumbTracker', () => {
  it('renders nothing', () => {
    const { container } = render(
      <MemoryRouter>
        <NavigationBreadcrumbTracker />
      </MemoryRouter>,
    )
    expect(container.innerHTML).toBe('')
  })
})
