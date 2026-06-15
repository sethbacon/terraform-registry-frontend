import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import ConsumedByPanel from '../ConsumedByPanel'
import type { ModuleConsumer } from '../../services/api'

const consumers: ModuleConsumer[] = [
  {
    source_id: 'src-1',
    source_name: 'prod-backend',
    state_key: 'env/prod/network.tfstate',
    module_version: null,
    observed_at: '2026-06-01T12:00:00Z',
  },
  {
    source_id: 'src-2',
    source_name: 'staging-backend',
    state_key: 'env/staging/app.tfstate',
    module_version: '1.4.0',
    observed_at: '2026-06-02T12:00:00Z',
  },
]

const defaultProps = {
  active: true,
  siblingUrl: 'https://tsm.example.com',
  consumers,
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ConsumedByPanel', () => {
  it('returns null when suite is inactive', () => {
    const { container } = render(<ConsumedByPanel {...defaultProps} active={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when there are no consumers', () => {
    const { container } = render(<ConsumedByPanel {...defaultProps} consumers={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the title and consumer count', () => {
    render(<ConsumedByPanel {...defaultProps} />)
    expect(screen.getByText('Consumed by')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders each consuming state', () => {
    render(<ConsumedByPanel {...defaultProps} />)
    expect(screen.getByText(/prod-backend — env\/prod\/network.tfstate/)).toBeInTheDocument()
    expect(screen.getByText(/staging-backend — env\/staging\/app.tfstate/)).toBeInTheDocument()
  })

  it('marks constraint-only entries and shows resolved versions', () => {
    render(<ConsumedByPanel {...defaultProps} />)
    expect(screen.getByText('constraint only')).toBeInTheDocument()
    expect(screen.getByText('1.4.0')).toBeInTheDocument()
  })

  it('falls back to source_id when source_name is empty', () => {
    const anon: ModuleConsumer[] = [{ ...consumers[0], source_name: '' }]
    render(<ConsumedByPanel {...defaultProps} consumers={anon} />)
    expect(screen.getByText(/src-1 — env\/prod\/network.tfstate/)).toBeInTheDocument()
  })

  it('opens the State Manager sources page in a new tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const user = userEvent.setup()
    render(<ConsumedByPanel {...defaultProps} />)
    await user.click(screen.getByText('Open in State Manager'))
    expect(openSpy).toHaveBeenCalledWith(
      'https://tsm.example.com/sources',
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('hides the open button when no sibling URL is known', () => {
    render(<ConsumedByPanel {...defaultProps} siblingUrl={undefined} />)
    expect(screen.queryByText('Open in State Manager')).not.toBeInTheDocument()
  })
})
