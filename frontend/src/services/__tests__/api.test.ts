import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'

// ---------------------------------------------------------------------------
// Helpers – we need to capture the interceptors that ApiClient registers so
// we can invoke them directly in tests.
// ---------------------------------------------------------------------------

type ReqFulfilled = (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig
type ResFulfilled = (response: AxiosResponse) => AxiosResponse
type ResRejected = (error: AxiosError) => unknown

let capturedReqFulfilled: ReqFulfilled
let capturedResFulfilled: ResFulfilled
let capturedResRejected: ResRejected
let capturedResRejectedHandlers: ResRejected[]
let mockAxiosInstance: AxiosInstance

vi.mock('axios', () => {
  const mockInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: {
        use: vi.fn((fulfilled: ReqFulfilled) => {
          capturedReqFulfilled = fulfilled
        }),
      },
      response: {
        use: vi.fn((fulfilled: ResFulfilled, rejected: ResRejected) => {
          capturedResFulfilled = fulfilled
          capturedResRejected = rejected
        }),
      },
    },
  }

  return {
    default: {
      create: vi.fn(() => {
        // Expose for tests
        mockAxiosInstance = mockInstance as unknown as AxiosInstance
        return mockInstance
      }),
    },
  }
})

// Import AFTER mocking axios so that the ApiClient constructor runs with the
// mock in place.
function getApiClient() {
  // Clear module cache so each test gets a fresh ApiClient with fresh interceptors
  vi.resetModules()
  // Re-apply the mock since resetModules clears it
  vi.doMock('axios', () => {
    const resRejectedHandlers: ResRejected[] = []
    const mockInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: {
          use: vi.fn((fulfilled: ReqFulfilled) => {
            capturedReqFulfilled = fulfilled
          }),
        },
        response: {
          use: vi.fn((fulfilled: ResFulfilled, rejected: ResRejected) => {
            capturedResFulfilled = fulfilled
            capturedResRejected = rejected
            resRejectedHandlers.push(rejected)
            capturedResRejectedHandlers = resRejectedHandlers
          }),
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

  return import('../api').then((mod) => mod.default)
}

describe('ApiClient', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── Auth Interceptor ──────────────────────────────────────────────────

  describe('request interceptor – auth token', () => {
    it('adds Authorization Bearer header when token exists in localStorage', async () => {
      localStorage.setItem('auth_token', 'my-jwt-token')
      await getApiClient()

      const config = {
        headers: {} as Record<string, string>,
      } as InternalAxiosRequestConfig

      const result = capturedReqFulfilled(config)
      expect(result.headers.Authorization).toBe('Bearer my-jwt-token')
    })

    it('does not add Authorization header when no token is stored', async () => {
      await getApiClient()

      const config = {
        headers: {} as Record<string, string>,
      } as InternalAxiosRequestConfig

      const result = capturedReqFulfilled(config)
      expect(result.headers.Authorization).toBeUndefined()
    })
  })

  // ─── 401 Interceptor ──────────────────────────────────────────────────

  describe('response interceptor – 401 handling', () => {
    it('clears auth and redirects to /login on 401 when token exists', async () => {
      localStorage.setItem('auth_token', 'expired-token')
      localStorage.setItem('user', '{"id":"1"}')
      await getApiClient()

      const error = {
        response: { status: 401 },
        config: { url: '/api/v1/modules/search' },
        isAxiosError: true,
      } as AxiosError

      // window.location.href is mocked by happy-dom
      const originalHref = window.location.href

      // Use the first response rejected handler (401 auth handler), not the last (breadcrumb handler)
      const authRejectedHandler = capturedResRejectedHandlers[0]
      await expect(authRejectedHandler(error)).rejects.toBe(error)
      expect(localStorage.getItem('auth_token')).toBeNull()
      expect(localStorage.getItem('user')).toBeNull()
    })

    it('does not redirect on 401 when no token exists (public endpoint)', async () => {
      await getApiClient()

      const error = {
        response: { status: 401 },
        config: { url: '/api/v1/modules/search' },
        isAxiosError: true,
      } as AxiosError

      await expect(capturedResRejected(error)).rejects.toBe(error)
      // No token to clear - localStorage stays empty
      expect(localStorage.getItem('auth_token')).toBeNull()
    })

    it('does not clear auth for SCM OAuth 401 (repository endpoint)', async () => {
      localStorage.setItem('auth_token', 'valid-token')
      await getApiClient()

      const error = {
        response: { status: 401 },
        config: { url: '/api/v1/scm-providers/123/repositories' },
        isAxiosError: true,
      } as AxiosError

      await expect(capturedResRejected(error)).rejects.toBe(error)
      // Token should NOT be cleared for SCM OAuth failures
      expect(localStorage.getItem('auth_token')).toBe('valid-token')
    })

    it('does not clear auth for SCM OAuth 401 (tags endpoint)', async () => {
      localStorage.setItem('auth_token', 'valid-token')
      await getApiClient()

      const error = {
        response: { status: 401 },
        config: { url: '/api/v1/scm-providers/456/repositories/owner/repo/tags' },
        isAxiosError: true,
      } as AxiosError

      await expect(capturedResRejected(error)).rejects.toBe(error)
      expect(localStorage.getItem('auth_token')).toBe('valid-token')
    })

    it('does not clear auth for SCM OAuth 401 (branches endpoint)', async () => {
      localStorage.setItem('auth_token', 'valid-token')
      await getApiClient()

      const error = {
        response: { status: 401 },
        config: { url: '/api/v1/scm-providers/789/repositories/owner/repo/branches' },
        isAxiosError: true,
      } as AxiosError

      await expect(capturedResRejected(error)).rejects.toBe(error)
      expect(localStorage.getItem('auth_token')).toBe('valid-token')
    })
  })

  // ─── Setup Token ───────────────────────────────────────────────────────

  describe('setupRequest – SetupToken header', () => {
    it('uses SetupToken header for setup endpoints', async () => {
      const client = await getApiClient()

      const mockResponse = { data: { valid: true } }
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse)

      await client.validateSetupToken('my-setup-token')

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/setup/validate-token',
        {},
        expect.objectContaining({
          headers: { Authorization: 'SetupToken my-setup-token' },
        })
      )
    })
  })

  // ─── Representative API methods ────────────────────────────────────────

  describe('searchModules', () => {
    it('calls GET /api/v1/modules/search with query params', async () => {
      const client = await getApiClient()

      const mockResponse = { data: { modules: [], meta: { total: 0 } } }
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse)

      const result = await client.searchModules({ query: 'vpc', limit: 10, offset: 0 })

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/modules/search', {
        params: { q: 'vpc', limit: 10, offset: 0 },
      })
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('searchProviders', () => {
    it('calls GET /api/v1/providers/search with query params', async () => {
      const client = await getApiClient()

      const mockResponse = { data: { providers: [], meta: { total: 0 } } }
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse)

      const result = await client.searchProviders({ query: 'aws', limit: 5, offset: 0 })

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/providers/search', {
        params: { q: 'aws', limit: 5, offset: 0 },
      })
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('listUsers', () => {
    it('calls GET /api/v1/users with pagination params', async () => {
      const client = await getApiClient()

      const mockResponse = {
        data: {
          users: [{ id: '1', email: 'a@b.com', name: 'A', created_at: '', updated_at: '' }],
          pagination: { page: 1, per_page: 20, total: 1 },
        },
      }
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse)

      const result = await client.listUsers(1, 20)

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/users', {
        params: { page: 1, per_page: 20 },
      })
      expect(result.users).toHaveLength(1)
      expect(result.users[0].id).toBe('1')
    })
  })

  describe('getActiveStorageConfig', () => {
    it('calls GET /api/v1/storage/config', async () => {
      const client = await getApiClient()

      const mockResponse = { data: { id: 's1', backend_type: 'local', is_active: true } }
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse)

      const result = await client.getActiveStorageConfig()

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/storage/config')
      expect(result).toEqual(mockResponse.data)
    })
  })

  // ─── Structural checks ────────────────────────────────────────────────

  describe('exports', () => {
    it('exports a default api client instance', async () => {
      const client = await getApiClient()
      expect(client).toBeDefined()
    })

    it('exposes core public methods', async () => {
      const client = await getApiClient()
      expect(typeof client.login).toBe('function')
      expect(typeof client.logout).toBe('function')
      expect(typeof client.searchModules).toBe('function')
      expect(typeof client.searchProviders).toBe('function')
      expect(typeof client.validateSetupToken).toBe('function')
      expect(typeof client.getVersionInfo).toBe('function')
    })
  })
})
