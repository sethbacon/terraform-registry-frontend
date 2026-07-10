import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import OfflineBanner from '../OfflineBanner'

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  })
}

describe('OfflineBanner', () => {
  afterEach(() => {
    setNavigatorOnline(true)
  })

  it('renders nothing while online', () => {
    setNavigatorOnline(true)
    render(<OfflineBanner />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows the offline warning when offline', () => {
    setNavigatorOnline(false)
    render(<OfflineBanner />)
    expect(
      screen.getByText(
        "You're offline. Some features may not work until your connection is restored.",
      ),
    ).toBeInTheDocument()
  })

  it('appears on the offline event and disappears on the online event', async () => {
    setNavigatorOnline(true)
    render(<OfflineBanner />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    // MUI's Snackbar exit transition keeps the node mounted (fading out) for a
    // moment after closing, so wait for it to actually leave the DOM.
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })
})
