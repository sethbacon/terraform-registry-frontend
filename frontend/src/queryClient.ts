import { QueryClient } from '@tanstack/react-query'
import { getErrorStatus } from './utils/errors'

/**
 * Retry predicate for queries. A 4xx response is deterministic (auth, forbidden,
 * not-found, validation) — retrying it only doubles latency-to-error and, for a
 * 401, needlessly re-runs the session-invalidation path against an authorization
 * boundary. Retry once for everything else (5xx, network/no-response); never for
 * 4xx (audit #616).
 */
export function retryQuery(failureCount: number, error: unknown): boolean {
  const status = getErrorStatus(error)
  if (status !== undefined && status >= 400 && status < 500) return false
  return failureCount < 1
}

/**
 * Shared react-query client.
 *
 * Exported from its own module (rather than defined inline in App) so the logout /
 * onClearStorage path can clear the cache on sign-out — otherwise prior-user admin/query
 * data lingers in memory until a full page reload, a retention gap on shared/kiosk machines.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: retryQuery,
      refetchOnWindowFocus: false,
    },
  },
})
