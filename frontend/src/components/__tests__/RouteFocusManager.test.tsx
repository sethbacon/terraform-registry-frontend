import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useRouteFocus', () => ({
  useRouteFocus: vi.fn(),
}))

import RouteFocusManager from '../RouteFocusManager'

describe('RouteFocusManager', () => {
  it('renders nothing', () => {
    const { container } = render(
      <MemoryRouter>
        <RouteFocusManager />
      </MemoryRouter>,
    )
    expect(container.innerHTML).toBe('')
  })
})
