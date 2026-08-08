import { Suspense } from 'react'
import type { ComponentType } from 'react'
import ErrorBoundary from './ErrorBoundary'
import ProtectedRoute from './ProtectedRoute'
import type { ScopeValue } from '../types/rbac'

const loader = <div>Loading...</div>

/**
 * A route is either explicitly public, or it states a scope requirement. There
 * is no third shape.
 *
 * Omitting `requiredScope` used to mean "public", which made "public" the value
 * a MISSING map key produced -- so a renamed admin path silently downgraded an
 * admin page to fully anonymous, the strongest possible fail-open, with no
 * compile error (#686). Public is now something a route has to SAY.
 */
type LazyRouteProps = { Component: ComponentType } & (
  | {
      /** No auth gate at all. Must be stated; it is never inferred. */
      isPublic: true
      requiredScope?: never
    }
  | {
      isPublic?: false
      /**
       * `null` requires an authenticated user but no specific scope; a scope
       * string gates the route on it (via ProtectedRoute). Required -- there is
       * no value that means "no gate" here.
       */
      requiredScope: ScopeValue | null
    }
)

/**
 * Composes the ErrorBoundary + Suspense (+ optional ProtectedRoute) wrapper
 * that every lazy-loaded route in App.tsx needs, so route definitions only
 * specify the component and its scope requirement.
 */
const LazyRoute = ({ Component, ...gate }: LazyRouteProps) => {
  const body = (
    <ErrorBoundary>
      <Suspense fallback={loader}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  )

  if (gate.isPublic) {
    return body
  }

  // `requiredScope` is non-optional on this branch of the union, so there is no
  // undefined case left to fall through to the ungated `body` above.
  return <ProtectedRoute requiredScope={gate.requiredScope ?? undefined}>{body}</ProtectedRoute>
}

export default LazyRoute
