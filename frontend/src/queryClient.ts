import { QueryClient } from '@tanstack/react-query'

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
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
