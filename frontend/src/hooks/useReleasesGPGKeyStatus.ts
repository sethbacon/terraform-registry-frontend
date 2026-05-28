import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../services/queryKeys'
import api from '../services/api'
import type { ReleasesGPGKeysResponse } from '../types/releases_gpg_keys'

export function useReleasesGPGKeyStatus() {
  return useQuery<ReleasesGPGKeysResponse>({
    queryKey: queryKeys.terraformMirrors.releasesGPGKeys(),
    queryFn: () => api.getReleasesGPGKeys(),
    staleTime: 5 * 60 * 1000,
  })
}
