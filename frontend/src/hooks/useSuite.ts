import { useQuery } from '@tanstack/react-query'

export interface SuiteSibling {
  app: string
  state: 'active' | 'degraded' | 'unreachable' | 'unknown'
  publicUrl?: string
  links?: Record<string, string>
}

async function fetchUIConfig(): Promise<{ sibling: SuiteSibling | null }> {
  const res = await fetch('/api/v1/ui/config', { credentials: 'include' })
  if (!res.ok) return { sibling: null }
  return res.json()
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
