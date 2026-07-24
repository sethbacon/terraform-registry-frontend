/**
 * Suite sibling-discovery domain API — reports whether a paired suite app
 * (e.g. terraform-state-manager) is reachable and how to link to it.
 */
import { http } from './http'

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

// Lives here (not in useSuite.ts) so this call goes through the shared http
// client -- inheriting API_BASE_URL resolution for the split-origin deployment
// mode and CSRF/401 handling -- and is covered by scripts/contract-check.ts,
// which only walks domain modules under services/api/ (#600).
export async function getUIConfig(): Promise<{ sibling: SuiteSibling | null }> {
  const response = await http.get<{ sibling: SuiteSibling | null }>('/api/v1/ui/config')
  return response.data
}
