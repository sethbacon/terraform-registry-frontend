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
    const { container } = render(
      <StatusAlerts status={makeStatus()} mb={2} order="error-first" dismissible />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  // The pages relied on MUI's default role="alert" to announce the banner;
  // that is the behaviour this component has to keep.
  it('announces the error message to assistive technology', () => {
    render(
      <StatusAlerts
        status={makeStatus({ error: 'boom' })}
        mb={2}
        order="error-first"
        dismissible
      />,
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('boom')
  })

  it('announces the success message to assistive technology', () => {
    render(
      <StatusAlerts
        status={makeStatus({ success: 'saved' })}
        mb={2}
        order="error-first"
        dismissible
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('saved')
  })

  it('renders the error above the success when both are set', () => {
    render(
      <StatusAlerts
        status={makeStatus({ error: 'boom', success: 'saved' })}
        mb={2}
        order="error-first"
        dismissible
      />,
    )
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(2)
    expect(alerts[0]).toHaveTextContent('boom')
    expect(alerts[1]).toHaveTextContent('saved')
  })

  it('dismisses the error without touching the success message', () => {
    const status = makeStatus({ error: 'boom', success: 'saved' })
    render(<StatusAlerts status={status} mb={2} order="error-first" dismissible />)
    const errorAlert = screen.getAllByRole('alert')[0]
    fireEvent.click(within(errorAlert).getByRole('button'))
    expect(status.setError).toHaveBeenCalledWith(null)
    expect(status.setSuccess).not.toHaveBeenCalled()
  })

  it('dismisses the success without touching the error message', () => {
    const status = makeStatus({ error: 'boom', success: 'saved' })
    render(<StatusAlerts status={status} mb={2} order="error-first" dismissible />)
    const successAlert = screen.getAllByRole('alert')[1]
    fireEvent.click(within(successAlert).getByRole('button'))
    expect(status.setSuccess).toHaveBeenCalledWith(null)
    expect(status.setError).not.toHaveBeenCalled()
  })

  // mb varies per page (2 or 3), so prove it actually reaches the alert's sx
  // rather than being dropped on the floor.
  it('applies the requested bottom margin', () => {
    const status = makeStatus({ error: 'boom' })
    const { rerender } = render(
      <StatusAlerts status={status} mb={2} order="error-first" dismissible />,
    )
    const spacingTwo = screen.getByRole('alert').className
    rerender(<StatusAlerts status={status} mb={3} order="error-first" dismissible />)
    expect(screen.getByRole('alert').className).not.toBe(spacingTwo)
  })

  it('renders the success above the error when the page asks for success-first', () => {
    render(
      <StatusAlerts
        status={makeStatus({ error: 'boom', success: 'saved' })}
        mb={2}
        order="success-first"
        dismissible
      />,
    )
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(2)
    expect(alerts[0]).toHaveTextContent('saved')
    expect(alerts[1]).toHaveTextContent('boom')
  })

  // A page that shows only one of the two messages must look the same under
  // either order, so success-first is not silently reordering anything else.
  it('renders a lone error identically under success-first', () => {
    render(
      <StatusAlerts
        status={makeStatus({ error: 'boom' })}
        mb={2}
        order="success-first"
        dismissible
      />,
    )
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toHaveTextContent('boom')
  })

  // MUI renders the close button only when onClose is supplied, so the
  // non-dismissible variant has to omit the handler rather than pass a no-op.
  it('omits the close button on both banners when not dismissible', () => {
    render(
      <StatusAlerts
        status={makeStatus({ error: 'boom', success: 'saved' })}
        mb={0}
        order="error-first"
        dismissible={false}
      />,
    )
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(2)
    expect(within(alerts[0]).queryByRole('button')).not.toBeInTheDocument()
    expect(within(alerts[1]).queryByRole('button')).not.toBeInTheDocument()
  })

  it('still announces both messages when not dismissible', () => {
    render(
      <StatusAlerts
        status={makeStatus({ error: 'boom', success: 'saved' })}
        mb={0}
        order="error-first"
        dismissible={false}
      />,
    )
    const alerts = screen.getAllByRole('alert')
    expect(alerts[0]).toHaveTextContent('boom')
    expect(alerts[1]).toHaveTextContent('saved')
  })

  // mb={0} is how the upload pages spell "the bare <Alert> I used to have":
  // MUI's Alert carries no margin of its own, so an explicit 0 is a no-op
  // visually but keeps the spacing decision stated at the call site.
  it('accepts mb={0} for the pages whose alerts have no bottom margin', () => {
    render(
      <StatusAlerts
        status={makeStatus({ error: 'boom' })}
        mb={0}
        order="error-first"
        dismissible={false}
      />,
    )
    expect(screen.getByRole('alert')).toHaveStyle({ marginBottom: '0px' })
  })
})
