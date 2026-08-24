import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { AxiosResponse } from 'axios'
import { http } from '../../services/api/http'
import { useSuite } from '../useSuite'

function axiosResponse<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>
}

function withQuery() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useSuite', () => {
  // Regression guard (#600): fetchUIConfig must go through the shared http
  // client -- not a hardcoded relative fetch() -- so it inherits API_BASE_URL
  // resolution in the split-origin deployment mode, CSRF/401 handling, and
  // scripts/contract-check.ts coverage like every other backend call.
  it('resolves the sibling config via the shared http client, not a bare fetch()', async () => {
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue(
      axiosResponse({
        sibling: {
          app: 'terraform-state-manager',
          state: 'active',
          publicUrl: 'https://tsm.example.com',
        },
      }),
    )
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const { result } = renderHook(() => useSuite(), { wrapper: withQuery() })

    await waitFor(() => expect(result.current.active).toBe(true))

    expect(getSpy).toHaveBeenCalledWith('/api/v1/ui/config')
    // A raw, hardcoded-relative fetch() would bypass API_BASE_URL resolution in
    // the split-origin deployment mode -- assert it is never used for this call.
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('degrades to no sibling when the request fails', async () => {
    vi.spyOn(http, 'get').mockRejectedValue(new Error('network error'))

    const { result } = renderHook(() => useSuite(), { wrapper: withQuery() })

    await waitFor(() => expect(result.current.sibling).toBeNull())
    expect(result.current.active).toBe(false)
  })
})
