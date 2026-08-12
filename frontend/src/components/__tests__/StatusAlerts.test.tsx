import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import StatusAlerts from '../StatusAlerts'
import type { StatusMessage } from '../../hooks/useStatusMessage'

function makeStatus(overrides: Partial<StatusMessage> = {}): StatusMessage {
  return {
    error: null,
    success: null,
    setError: vi.fn(),
    setSuccess: vi.fn(),
    showSuccess: vi.fn(),
    clear: vi.fn(),
    ...overrides,
  }
}

describe('StatusAlerts', () => {
  it('renders nothing when there is no message', () => {
    const { container } = render(<StatusAlerts status={makeStatus()} mb={2} />)
    expect(container).toBeEmptyDOMElement()
  })

  // The pages relied on MUI's default role="alert" to announce the banner;
  // that is the behaviour this component has to keep.
  it('announces the error message to assistive technology', () => {
    render(<StatusAlerts status={makeStatus({ error: 'boom' })} mb={2} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('boom')
  })

  it('announces the success message to assistive technology', () => {
    render(<StatusAlerts status={makeStatus({ success: 'saved' })} mb={2} />)
    expect(screen.getByRole('alert')).toHaveTextContent('saved')
  })

  it('renders the error above the success when both are set', () => {
    render(<StatusAlerts status={makeStatus({ error: 'boom', success: 'saved' })} mb={2} />)
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(2)
    expect(alerts[0]).toHaveTextContent('boom')
    expect(alerts[1]).toHaveTextContent('saved')
  })

  it('dismisses the error without touching the success message', () => {
    const status = makeStatus({ error: 'boom', success: 'saved' })
    render(<StatusAlerts status={status} mb={2} />)
    const errorAlert = screen.getAllByRole('alert')[0]
    fireEvent.click(within(errorAlert).getByRole('button'))
    expect(status.setError).toHaveBeenCalledWith(null)
    expect(status.setSuccess).not.toHaveBeenCalled()
  })

  it('dismisses the success without touching the error message', () => {
    const status = makeStatus({ error: 'boom', success: 'saved' })
    render(<StatusAlerts status={status} mb={2} />)
    const successAlert = screen.getAllByRole('alert')[1]
    fireEvent.click(within(successAlert).getByRole('button'))
    expect(status.setSuccess).toHaveBeenCalledWith(null)
    expect(status.setError).not.toHaveBeenCalled()
  })

  // mb varies per page (2 or 3), so prove it actually reaches the alert's sx
  // rather than being dropped on the floor.
  it('applies the requested bottom margin', () => {
    const status = makeStatus({ error: 'boom' })
    const { rerender } = render(<StatusAlerts status={status} mb={2} />)
    const spacingTwo = screen.getByRole('alert').className
    rerender(<StatusAlerts status={status} mb={3} />)
    expect(screen.getByRole('alert').className).not.toBe(spacingTwo)
  })
})
