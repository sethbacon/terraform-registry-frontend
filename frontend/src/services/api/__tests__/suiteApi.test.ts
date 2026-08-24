import { describe, it, expect, vi, afterEach } from 'vitest'
import type { AxiosResponse } from 'axios'
import { http } from '../http'
import { getUIConfig } from '../suiteApi'

function axiosResponse<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getUIConfig', () => {
  // Regression guard (#600): this call must go through the shared http client
  // (not a hardcoded relative fetch()) -- and live under services/api/ -- so it
  // inherits API_BASE_URL resolution, CSRF/401 handling, and is visible to
  // scripts/contract-check.ts, which only walks domain modules in this directory.
  it('requests the sibling config via the shared http client', async () => {
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue(axiosResponse({ sibling: null }))

    const result = await getUIConfig()

    expect(getSpy).toHaveBeenCalledWith('/api/v1/ui/config')
    expect(result).toEqual({ sibling: null })
  })

  it('propagates a request failure to the caller (no swallowing here)', async () => {
    vi.spyOn(http, 'get').mockRejectedValue(new Error('network error'))

    await expect(getUIConfig()).rejects.toThrow('network error')
  })
})
