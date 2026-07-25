import { describe, it, expect, vi } from 'vitest'
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'

// devApi.ts is deliberately excluded from the composed `services/api` barrel
// (see services/api/index.ts) so its dev-only endpoints can be dead-code-
// eliminated from the production bundle instead of riding along in every
// page's eager `import api from '../services/api'` (#608). It is tested here,
// against its own module boundary, mirroring the axios-mock pattern used for
// the composed client in services/__tests__/api.test.ts.

type ReqFulfilled = (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig
type ResFulfilled = (response: AxiosResponse) => AxiosResponse
type ResRejected = (error: AxiosError) => unknown

let mockAxiosInstance: AxiosInstance

function getDevApi() {
  vi.resetModules()
  vi.doMock('axios', () => {
    const mockInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: {
          use: vi.fn((_fulfilled: ReqFulfilled) => {}),
        },
        response: {
          use: vi.fn((_fulfilled: ResFulfilled, _rejected: ResRejected) => {}),
        },
      },
    }
    return {
      default: {
        create: vi.fn(() => {
          mockAxiosInstance = mockInstance as unknown as AxiosInstance
          return mockInstance
        }),
      },
    }
  })

  return import('../devApi')
}

describe('devApi', () => {
  it('devLogin calls POST /api/v1/dev/login (cookie is set server-side, token-less body)', async () => {
    const devApi = await getDevApi()
      ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { user: { id: 'u1' }, expires_in: 3600 },
      })
    const result = await devApi.devLogin()
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/dev/login')
    expect(result.expires_in).toBe(3600)
  })

  it('getDevStatus calls GET /api/v1/dev/status', async () => {
    const devApi = await getDevApi()
      ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { dev_mode: true },
      })
    const result = await devApi.getDevStatus()
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/dev/status')
    expect(result.dev_mode).toBe(true)
  })

  it('listUsersForImpersonation calls GET /api/v1/dev/users', async () => {
    const devApi = await getDevApi()
      ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { users: [], dev_mode: true },
      })
    const result = await devApi.listUsersForImpersonation()
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/dev/users')
    expect(result.dev_mode).toBe(true)
  })

  it('impersonateUser calls POST /api/v1/dev/impersonate/:id (cookie swap, token-less body)', async () => {
    const devApi = await getDevApi()
      ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { user: { id: 'u1', email: 'a@b.com', name: 'A' }, message: 'ok' },
      })
    const result = await devApi.impersonateUser('u1')
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/dev/impersonate/u1')
    expect(result.message).toBe('ok')
  })
})
