import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { addNavigationBreadcrumb } from '../services/errorReporting'
import { reportNavigation } from '../services/performanceReporting'

/**
 * Records a navigation breadcrumb via errorReporting's addNavigationBreadcrumb,
 * and a route-level navigation timing via performanceReporting's reportNavigation,
 * on every SPA route change -- so a captured error's breadcrumb trail includes
 * "came from -> went to" context (e.g. for diagnosing login-flow errors), and
 * performance reporting captures a proxy for route transition cost.
 *
 * Note: the reported duration is measured from when the *previous* route's
 * effect committed to when this one does, i.e. it includes dwell time on the
 * prior route (think-time, click latency), not just the new route's render
 * time. There is no earlier "navigation started" signal available from
 * `useLocation()` alone to isolate pure transition time, so this is a
 * defensible approximation rather than an exact transition measurement.
 */
export function useNavigationBreadcrumbs() {
  const location = useLocation()
  const previousPath = useRef<string | null>(null)
  const lastTransitionAt = useRef<number>(performance.now())

  useEffect(() => {
    const to = location.pathname
    const now = performance.now()
    if (previousPath.current !== null && previousPath.current !== to) {
      addNavigationBreadcrumb(previousPath.current, to)
      reportNavigation(to, now - lastTransitionAt.current)
    }
    previousPath.current = to
    lastTransitionAt.current = now
  }, [location.pathname])
}
