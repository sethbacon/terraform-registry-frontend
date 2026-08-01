import { describe, it, expect, vi, afterEach } from 'vitest'
import { AxiosError, type AxiosResponse } from 'axios'
import { http } from '../http'
import { getAdminUITheme, getUITheme } from '../themeApi'

function axiosResponse<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>
}

function axiosStatusError(status: number): AxiosError {
  const err = new AxiosError('Request failed')
  err.response = {
    status,
    statusText: '',
    headers: {},
    config: {} as never,
    data: {},
  }
  return err
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getUITheme', () => {
  // The theme provider calls this at app start, where a failure must never
  // block rendering -- so swallowing to null is correct *here* specifically.
  it('swallows every failure into null so theming cannot block app start', async () => {
    vi.spyOn(http, 'get').mockRejectedValue(axiosStatusError(500))
    await expect(getUITheme()).resolves.toBeNull()
  })
})

describe('getAdminUITheme', () => {
  it('returns the stored config', async () => {
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue(axiosResponse({ product_name: 'Acme' }))

    await expect(getAdminUITheme()).resolves.toEqual({ product_name: 'Acme' })
    expect(getSpy).toHaveBeenCalledWith('/api/v1/ui/theme')
  })

  it('maps 404 to null -- branding has simply never been configured', async () => {
    vi.spyOn(http, 'get').mockRejectedValue(axiosStatusError(404))
    await expect(getAdminUITheme()).resolves.toBeNull()
  })

  // The editor's PUT is a full replace. If a failed read were reported as "no
  // branding configured", the admin would be shown an empty form and their next
  // Save would blank every field they were never shown -- so unlike getUITheme,
  // this must reject rather than swallow.
  it.each([500, 502, 401, 403])('propagates a %i so the editor can refuse to render', async (status) => {
    vi.spyOn(http, 'get').mockRejectedValue(axiosStatusError(status))
    await expect(getAdminUITheme()).rejects.toBeInstanceOf(AxiosError)
  })

  it('propagates a network failure that has no response at all', async () => {
    vi.spyOn(http, 'get').mockRejectedValue(new AxiosError('Network Error'))
    await expect(getAdminUITheme()).rejects.toThrow('Network Error')
  })
})
