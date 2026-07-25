import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { UserMembership } from '../types'

/**
 * Loads the current user's organization memberships and, when a default-org
 * setter is provided, defaults a caller-managed "selected organization"
 * value to the first membership once memberships load and no value has been
 * chosen yet.
 *
 * Shared by admin pages that let the user attach a newly-created resource to
 * one of their organizations (module upload, SCM provider setup, API keys).
 * Pages that only need the membership list (no auto-default behavior) may
 * omit `currentOrgId`/`setDefaultOrgId`.
 *
 * `membershipsQueryKeyPrefix` is each page's own query-key namespace (e.g.
 * `queryKeys.users._def`) — the current user's id is appended internally so
 * callers don't have to repeat `user?.id ?? ''` themselves.
 */
export function useDefaultOrgMembership(
  membershipsQueryKeyPrefix: readonly unknown[],
  currentOrgId?: string,
  setDefaultOrgId?: (organizationId: string) => void,
) {
  const { user } = useAuth()

  const { data: memberships = [], isLoading } = useQuery<UserMembership[]>({
    queryKey: [...membershipsQueryKeyPrefix, 'memberships', user?.id ?? ''],
    queryFn: async () => {
      const data = await api.getCurrentUserMemberships()
      return data || []
    },
    enabled: !!user?.id,
  })

  useEffect(() => {
    if (!setDefaultOrgId) return
    if (memberships.length > 0 && !currentOrgId) {
      setDefaultOrgId(memberships[0].organization_id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberships])

  return { memberships, isLoading }
}
