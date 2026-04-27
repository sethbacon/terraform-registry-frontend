import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAnnouncer } from '../contexts/AnnouncerContext'

/**
 * Custom hook that manages focus and screen-reader announcements on SPA
 * route changes.
 *
 * On each navigation:
 * 1. Moves focus to the first <h1> on the page (or falls back to <main>).
 * 2. Announces the new page title via the live-region announcer.
 */
export function useRouteFocus() {
  const location = useLocation()
  const { announce } = useAnnouncer()
  const isFirstRender = useRef(true)

  useEffect(() => {
    // Skip the initial render — the page loads normally on first visit
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    // Small delay to let the new page render before moving focus
    const timer = setTimeout(() => {
      const heading = document.querySelector<HTMLElement>('h1')
      const main = document.querySelector<HTMLElement>('main')
      const target = heading ?? main

      if (target) {
        // Make the element temporarily focusable if it isn't already
        if (!target.hasAttribute('tabindex')) {
          target.setAttribute('tabindex', '-1')
          target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true })
        }
        target.focus({ preventScroll: false })
      }

      // Announce the page title for screen readers
      const title = document.title || heading?.textContent || ''
      if (title) {
        announce(`Navigated to ${title}`)
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [location.pathname, announce])
}
