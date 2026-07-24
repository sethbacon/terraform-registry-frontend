import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import type { SuiteSibling } from '../services/api'

export type { SuiteSibling }

async function fetchUIConfig(): Promise<{ sibling: SuiteSibling | null }> {
  // Swallow any network/parse failure (endpoint absent pre-Phase-0, sibling
  // unreachable, or no backend in tests) and degrade to "no sibling". This keeps
  // the switcher inert instead of surfacing an unhandled rejection — notably,
  // every test that renders <Layout> mounts useSuite, and an un-stubbed request
  // would otherwise throw ECONNREFUSED.
  //
  // api.getUIConfig() (services/api/suiteApi.ts) routes through the shared http
  // client (not a bare fetch()) so this call inherits API_BASE_URL resolution
  // for the split-origin deployment mode, CSRF/401 handling, and
  // scripts/contract-check.ts coverage like every other backend call in the
  // app (#600).
  try {
    return await api.getUIConfig()
  } catch {
    return { sibling: null }
  }
}

export function useSuite() {
  const { data } = useQuery({
    queryKey: ['suite', 'ui-config'],
    queryFn: fetchUIConfig,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  })
  const sibling = data?.sibling ?? null
  return { sibling, active: sibling?.state === 'active' && !!sibling.publicUrl }
}
