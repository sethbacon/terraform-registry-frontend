import { useQuery } from '@tanstack/react-query'

export interface SuiteSibling {
  app: string
  state: 'active' | 'degraded' | 'unreachable' | 'unknown'
  publicUrl?: string
  links?: Record<string, string>
  // Identity provenance from the sibling's manifest. issuer identifies which app
  // minted its tokens; sharedStore is true only when an operator has confirmed
  // both apps use one identity store + IdP (single sign-on). Absent/false ⇒ the
  // switcher warns that opening the sibling may require a separate sign-in.
  issuer?: string
  sharedStore?: boolean
}

async function fetchUIConfig(): Promise<{ sibling: SuiteSibling | null }> {
  // Swallow any network/parse failure (endpoint absent pre-Phase-0, sibling
  // unreachable, or no backend in tests) and degrade to "no sibling". This keeps
  // the switcher inert instead of surfacing an unhandled rejection — notably,
  // every test that renders <Layout> mounts useSuite, and an un-stubbed fetch
  // would otherwise throw ECONNREFUSED.
  try {
    const res = await fetch('/api/v1/ui/config', { credentials: 'include' })
    if (!res.ok) return { sibling: null }
    return await res.json()
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
