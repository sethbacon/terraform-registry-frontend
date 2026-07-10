import { Suspense } from 'react'
import type { ComponentType } from 'react'
import ErrorBoundary from './ErrorBoundary'
import ProtectedRoute from './ProtectedRoute'

const loader = <div>Loading...</div>

interface LazyRouteProps {
  Component: ComponentType
  /**
   * Omit for a public route (no auth gate). Pass `null` for a route that
   * requires an authenticated user but no specific scope. Pass a scope
   * string for a route gated on that scope (via ProtectedRoute).
   */
  requiredScope?: string | null
}

/**
 * Composes the ErrorBoundary + Suspense (+ optional ProtectedRoute) wrapper
 * that every lazy-loaded route in App.tsx needs, so route definitions only
 * specify the component and its scope requirement.
 */
const LazyRoute = ({ Component, requiredScope }: LazyRouteProps) => {
  const body = (
    <ErrorBoundary>
      <Suspense fallback={loader}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  )

  if (requiredScope === undefined) {
    return body
  }

  return <ProtectedRoute requiredScope={requiredScope ?? undefined}>{body}</ProtectedRoute>
}

export default LazyRoute
