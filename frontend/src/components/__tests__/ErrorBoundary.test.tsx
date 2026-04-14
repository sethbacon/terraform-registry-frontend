import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErrorBoundary from '../ErrorBoundary'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the error reporting service
vi.mock('../../services/errorReporting', () => ({
  captureError: vi.fn(),
}))

import { captureError } from '../../services/errorReporting'

// Component that throws on demand
function ThrowingChild({ shouldThrow = false }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error from child')
  }
  return <div>Child rendered successfully</div>
}

// Wrapper that controls the throw via state
function ThrowController({ initialThrow = true }: { initialThrow?: boolean }) {
  return (
    <ErrorBoundary>
      <ThrowingChild shouldThrow={initialThrow} />
    </ErrorBoundary>
  )
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Suppress React error boundary console.error output in test logs
    vi.spyOn(console, 'error').mockImplementation(() => { })
  })

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Hello World</div>
      </ErrorBoundary>
    )

    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('renders fallback UI when child throws', () => {
    render(<ThrowController initialThrow={true} />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Test error from child')).toBeInTheDocument()
    expect(screen.queryByText('Child rendered successfully')).not.toBeInTheDocument()
  })

  it('calls captureError when an error is caught', () => {
    render(<ThrowController initialThrow={true} />)

    expect(captureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test error from child' }),
      expect.objectContaining({ componentStack: expect.any(String) })
    )
  })

  it('shows Try Again button that resets error state', async () => {
    const user = userEvent.setup()

    // We need a component where re-render after reset does not throw again
    let shouldThrow = true

    function ConditionalThrower() {
      if (shouldThrow) throw new Error('Boom')
      return <div>Recovered content</div>
    }

    render(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Stop throwing before clicking Try Again
    shouldThrow = false

    await user.click(screen.getByText('Try Again'))

    expect(screen.getByText('Recovered content')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('shows Reload Page button', () => {
    render(<ThrowController initialThrow={true} />)

    expect(screen.getByText('Reload Page')).toBeInTheDocument()
  })

  it('uses custom fallback prop when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback UI</div>}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom fallback UI')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })
})
