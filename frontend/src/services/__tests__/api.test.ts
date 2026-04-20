import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'

// ---------------------------------------------------------------------------
// Helpers – we need to capture the interceptors that ApiClient registers so
// we can invoke them directly in tests.
// ---------------------------------------------------------------------------

type ReqFulfilled = (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig
type ResFulfilled = (response: AxiosResponse) => AxiosResponse
type ResRejected = (error: AxiosError) => unknown

let capturedReqFulfilled: ReqFulfilled
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
        use: vi.fn((_fulfilled: ResFulfilled, rejected: ResRejected) => {
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
          use: vi.fn((_fulfilled: ResFulfilled, rejected: ResRejected) => {
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

  // ─── Auth ─────────────────────────────────────────────────────────────────
  describe('auth methods', () => {
    it('refreshToken calls POST /api/v1/auth/refresh', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { token: 'new' } })
      const result = await client.refreshToken()
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/auth/refresh')
      expect(result.token).toBe('new')
    })

    it('getCurrentUser calls GET /api/v1/auth/me', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { user: { id: 'u1', email: 'a@b.com' } } })
      const result = await client.getCurrentUser()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/auth/me')
      expect(result.id).toBe('u1')
    })

    it('getCurrentUserWithRole returns user, role_template, allowed_scopes', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { user: { id: 'u1' }, role_template: { id: 'r1' }, allowed_scopes: ['admin'] },
        })
      const result = await client.getCurrentUserWithRole()
      expect(result.user.id).toBe('u1')
      expect(result.role_template?.id).toBe('r1')
      expect(result.allowed_scopes).toEqual(['admin'])
    })

    it('getCurrentUserWithRole defaults missing fields', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { user: { id: 'u1' } },
        })
      const result = await client.getCurrentUserWithRole()
      expect(result.role_template).toBeNull()
      expect(result.allowed_scopes).toEqual([])
    })

    it('devLogin calls POST /api/v1/dev/login', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { token: 'dev-tok' } })
      const result = await client.devLogin()
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/dev/login')
      expect(result.token).toBe('dev-tok')
    })

    it('getDevStatus calls GET /api/v1/dev/status', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { dev_mode: true } })
      const result = await client.getDevStatus()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/dev/status')
      expect(result.dev_mode).toBe(true)
    })

    it('listUsersForImpersonation calls GET /api/v1/dev/users', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { users: [], dev_mode: true } })
      const result = await client.listUsersForImpersonation()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/dev/users')
      expect(result.dev_mode).toBe(true)
    })

    it('impersonateUser calls POST /api/v1/dev/impersonate/:id', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { token: 'imp-tok', message: 'ok' } })
      const result = await client.impersonateUser('u1')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/dev/impersonate/u1')
      expect(result.token).toBe('imp-tok')
    })
  })

  // ─── Modules ──────────────────────────────────────────────────────────────
  describe('module methods', () => {
    it('getModuleVersions', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { versions: [] } })
      await client.getModuleVersions('hashicorp', 'consul', 'aws')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v1/modules/hashicorp/consul/aws/versions')
    })

    it('createModuleRecord', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 'm1' } })
      const result = await client.createModuleRecord({ namespace: 'ns', name: 'mod', system: 'aws' })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/modules/create', { namespace: 'ns', name: 'mod', system: 'aws' })
      expect(result.id).toBe('m1')
    })

    it('uploadModule sends FormData', async () => {
      const client = await getApiClient()
      const fd = new FormData()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { ok: true } })
      await client.uploadModule(fd)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/modules', fd, expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } }))
    })

    it('getModule', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 'm1' } })
      await client.getModule('ns', 'mod', 'aws')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/modules/ns/mod/aws')
    })

    it('deleteModule', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteModule('ns', 'mod', 'aws')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/modules/ns/mod/aws')
    })

    it('deleteModuleVersion', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteModuleVersion('ns', 'mod', 'aws', '1.0.0')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/modules/ns/mod/aws/versions/1.0.0')
    })

    it('deprecateModuleVersion with message', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deprecateModuleVersion('ns', 'mod', 'aws', '1.0.0', 'old')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/modules/ns/mod/aws/versions/1.0.0/deprecate', { message: 'old' })
    })

    it('deprecateModuleVersion without message', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deprecateModuleVersion('ns', 'mod', 'aws', '1.0.0')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/modules/ns/mod/aws/versions/1.0.0/deprecate', {})
    })

    it('undeprecateModuleVersion', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.undeprecateModuleVersion('ns', 'mod', 'aws', '1.0.0')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/modules/ns/mod/aws/versions/1.0.0/deprecate')
    })

    it('deprecateModule', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deprecateModule('ns', 'mod', 'aws', { message: 'eol' })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/modules/ns/mod/aws/deprecate', { message: 'eol' })
    })

    it('undeprecateModule', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.undeprecateModule('ns', 'mod', 'aws')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/modules/ns/mod/aws/deprecate')
    })

    it('updateModule', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateModule('m1', { description: 'new desc' })
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/admin/modules/m1', { description: 'new desc' })
    })

    it('getModuleScan', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { status: 'clean' } })
      await client.getModuleScan('ns', 'mod', 'aws', '1.0.0')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/modules/ns/mod/aws/versions/1.0.0/scan')
    })

    it('getModuleDocs', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { content: '' } })
      await client.getModuleDocs('ns', 'mod', 'aws', '1.0.0')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/modules/ns/mod/aws/versions/1.0.0/docs')
    })
  })

  // ─── Providers ────────────────────────────────────────────────────────────
  describe('provider methods', () => {
    it('getProviderVersions', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { versions: [] } })
      await client.getProviderVersions('hashicorp', 'aws')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v1/providers/hashicorp/aws/versions')
    })

    it('uploadProvider sends FormData', async () => {
      const client = await getApiClient()
      const fd = new FormData()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.uploadProvider(fd)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/providers', fd, expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } }))
    })

    it('getProvider', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 'p1' } })
      await client.getProvider('hashicorp', 'aws')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/providers/hashicorp/aws')
    })

    it('deleteProvider', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteProvider('hashicorp', 'aws')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/providers/hashicorp/aws')
    })

    it('deleteProviderVersion', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteProviderVersion('hashicorp', 'aws', '5.0.0')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/providers/hashicorp/aws/versions/5.0.0')
    })

    it('deprecateProviderVersion with message', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deprecateProviderVersion('hashicorp', 'aws', '5.0.0', 'old')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/providers/hashicorp/aws/versions/5.0.0/deprecate', { message: 'old' })
    })

    it('deprecateProviderVersion without message', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deprecateProviderVersion('hashicorp', 'aws', '5.0.0')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/providers/hashicorp/aws/versions/5.0.0/deprecate', {})
    })

    it('undeprecateProviderVersion', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.undeprecateProviderVersion('hashicorp', 'aws', '5.0.0')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/providers/hashicorp/aws/versions/5.0.0/deprecate')
    })

    it('getProviderDocs with all params', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { docs: [] } })
      await client.getProviderDocs('hashicorp', 'aws', '5.0.0', 'resources', 'en', 10, 0)
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/providers/hashicorp/aws/versions/5.0.0/docs',
        { params: { category: 'resources', language: 'en', limit: 10, offset: 0 } },
      )
    })

    it('getProviderDocs without optional params', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { docs: [] } })
      await client.getProviderDocs('hashicorp', 'aws', '5.0.0')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/providers/hashicorp/aws/versions/5.0.0/docs',
        { params: {} },
      )
    })

    it('getProviderDocContent', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { content: '# Doc' } })
      await client.getProviderDocContent('hashicorp', 'aws', '5.0.0', 'resources', 'aws_instance')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/providers/hashicorp/aws/versions/5.0.0/docs/resources/aws_instance')
    })
  })

  // ─── Users ────────────────────────────────────────────────────────────────
  describe('user methods', () => {
    it('searchUsers', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { users: [{ id: 'u1', email: 'a@b.com', name: 'A', created_at: '', updated_at: '' }], pagination: {} },
        })
      const result = await client.searchUsers('test', 1, 10)
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/users/search', { params: { q: 'test', page: 1, per_page: 10 } })
      expect(result.users[0].id).toBe('u1')
    })

    it('getUser', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { user: { id: 'u1', email: 'a@b.com', name: 'A', created_at: '', updated_at: '' } },
        })
      const result = await client.getUser('u1')
      expect(result.id).toBe('u1')
    })

    it('createUser', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { user: { id: 'u2', email: 'b@b.com', name: 'B', created_at: '', updated_at: '' } },
        })
      const result = await client.createUser({ email: 'b@b.com', name: 'B' })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/users', { email: 'b@b.com', name: 'B' })
      expect(result.id).toBe('u2')
    })

    it('updateUser', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { user: { id: 'u1', email: 'a@b.com', name: 'Updated', created_at: '', updated_at: '' } },
        })
      const result = await client.updateUser('u1', { name: 'Updated' })
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/users/u1', { name: 'Updated' })
      expect(result.name).toBe('Updated')
    })

    it('deleteUser', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { ok: true } })
      await client.deleteUser('u1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/users/u1')
    })

    it('getUserMemberships', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { memberships: [{ org_id: 'o1' }] } })
      const result = await client.getUserMemberships('u1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/users/u1/memberships')
      expect(result).toHaveLength(1)
    })

    it('getCurrentUserMemberships', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { memberships: [] } })
      await client.getCurrentUserMemberships()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/users/me/memberships')
    })

    it('transformUser handles PascalCase fields', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { user: { ID: 'u1', Email: 'a@b.com', Name: 'A', CreatedAt: '2025-01-01', UpdatedAt: '2025-01-01', RoleTemplateID: 'r1' } },
        })
      const result = await client.getUser('u1')
      expect(result.id).toBe('u1')
      expect(result.email).toBe('a@b.com')
      expect(result.role_template_id).toBe('r1')
    })
  })

  // ─── Organizations ────────────────────────────────────────────────────────
  describe('organization methods', () => {
    it('listOrganizations', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { organizations: [{ id: 'o1', name: 'org1', display_name: 'Org 1', created_at: '', updated_at: '' }] },
        })
      const result = await client.listOrganizations(1, 20)
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/organizations', { params: { page: 1, per_page: 20 } })
      expect(result).toHaveLength(1)
    })

    it('searchOrganizations', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { organizations: [{ id: 'o1', name: 'org1', display_name: 'Org 1', created_at: '', updated_at: '' }] },
        })
      const result = await client.searchOrganizations('org', 1, 10)
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/organizations/search', { params: { q: 'org', page: 1, per_page: 10 } })
      expect(result).toHaveLength(1)
    })

    it('getOrganization', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { organization: { id: 'o1', name: 'org1', display_name: 'Org 1', created_at: '', updated_at: '' } },
        })
      const result = await client.getOrganization('o1')
      expect(result.id).toBe('o1')
    })

    it('createOrganization', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          status: 201,
          data: { organization: { id: 'o2', name: 'new', display_name: 'New', created_at: '', updated_at: '' } },
        })
      const result = await client.createOrganization({ name: 'new', display_name: 'New' })
      expect(result.id).toBe('o2')
    })

    it('updateOrganization', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { organization: { id: 'o1', name: 'org1', display_name: 'Updated', created_at: '', updated_at: '' } },
        })
      const result = await client.updateOrganization('o1', { display_name: 'Updated' })
      expect(result.display_name).toBe('Updated')
    })

    it('deleteOrganization', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteOrganization('o1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/organizations/o1')
    })

    it('addOrganizationMember', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.addOrganizationMember('o1', { user_id: 'u1' })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/organizations/o1/members', { user_id: 'u1' })
    })

    it('updateOrganizationMember', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateOrganizationMember('o1', 'u1', { role_template_id: 'r1' })
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/organizations/o1/members/u1', { role_template_id: 'r1' })
    })

    it('removeOrganizationMember', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.removeOrganizationMember('o1', 'u1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/organizations/o1/members/u1')
    })

    it('listOrganizationMembers', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { members: [{ user_id: 'u1' }] } })
      const result = await client.listOrganizationMembers('o1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/organizations/o1/members')
      expect(result).toHaveLength(1)
    })

    it('transformOrganization throws for undefined org', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { organization: undefined },
        })
      await expect(client.getOrganization('bad')).rejects.toThrow('Cannot transform undefined organization')
    })
  })

  // ─── API Keys ─────────────────────────────────────────────────────────────
  describe('API key methods', () => {
    it('listAPIKeys without org filter', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { keys: [{ id: 'k1', name: 'key1', scopes: [], created_at: '' }] },
        })
      const result = await client.listAPIKeys()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/apikeys', { params: {} })
      expect(result).toHaveLength(1)
    })

    it('listAPIKeys with org filter', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { keys: [] } })
      await client.listAPIKeys('org-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/apikeys', { params: { organization_id: 'org-1' } })
    })

    it('listAPIKeys normalizes PascalCase keys', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { keys: [{ ID: 'k1', Name: 'mykey', Scopes: ['read'], CreatedAt: '2025-01-01' }] },
        })
      const result = await client.listAPIKeys()
      expect(result[0].id).toBe('k1')
      expect(result[0].name).toBe('mykey')
      expect(result[0].scopes).toEqual(['read'])
    })

    it('createAPIKey', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { key: 'secret', id: 'k1' } })
      const data = { name: 'key1', organization_id: 'o1', scopes: ['read'] }
      await client.createAPIKey(data)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/apikeys', data)
    })

    it('getAPIKey', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 'k1' } })
      await client.getAPIKey('k1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/apikeys/k1')
    })

    it('updateAPIKey', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateAPIKey('k1', { name: 'updated' })
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/apikeys/k1', { name: 'updated' })
    })

    it('deleteAPIKey', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteAPIKey('k1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/apikeys/k1')
    })

    it('rotateAPIKey', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { new_key: 'secret2' } })
      await client.rotateAPIKey('k1', 24)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/apikeys/k1/rotate', { grace_period_hours: 24 })
    })
  })

  // ─── SCM Providers ────────────────────────────────────────────────────────
  describe('SCM provider methods', () => {
    it('listSCMProviders', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: [] })
      await client.listSCMProviders()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/scm-providers', { params: {} })
    })

    it('listSCMProviders with org', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: [] })
      await client.listSCMProviders('org-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/scm-providers', { params: { organization_id: 'org-1' } })
    })

    it('createSCMProvider', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 'scm-1' } })
      await client.createSCMProvider({ organization_id: 'o1', provider_type: 'github', name: 'GH' })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/scm-providers', expect.objectContaining({ provider_type: 'github' }))
    })

    it('getSCMProvider', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 'scm-1' } })
      await client.getSCMProvider('scm-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/scm-providers/scm-1')
    })

    it('updateSCMProvider', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateSCMProvider('scm-1', { name: 'Updated' })
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/scm-providers/scm-1', { name: 'Updated' })
    })

    it('deleteSCMProvider', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteSCMProvider('scm-1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/scm-providers/scm-1')
    })

    it('initiateSCMOAuth', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { redirect_url: 'https://github.com/oauth' } })
      await client.initiateSCMOAuth('scm-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/scm-providers/scm-1/oauth/authorize')
    })

    it('refreshSCMToken', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.refreshSCMToken('scm-1')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/scm-providers/scm-1/oauth/refresh')
    })

    it('getSCMTokenStatus', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { connected: true } })
      const result = await client.getSCMTokenStatus('scm-1')
      expect(result.connected).toBe(true)
    })

    it('listSCMRepositories', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { repositories: [] } })
      await client.listSCMRepositories('scm-1', 'search')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/scm-providers/scm-1/repositories', { params: { search: 'search' } })
    })

    it('listSCMRepositoryTags', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { tags: [] } })
      await client.listSCMRepositoryTags('scm-1', 'owner', 'repo')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/scm-providers/scm-1/repositories/owner/repo/tags')
    })

    it('listSCMRepositoryBranches', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { branches: [] } })
      await client.listSCMRepositoryBranches('scm-1', 'owner', 'repo')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/scm-providers/scm-1/repositories/owner/repo/branches')
    })

    it('revokeSCMToken', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.revokeSCMToken('scm-1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/scm-providers/scm-1/oauth/token')
    })

    it('saveSCMToken', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.saveSCMToken('scm-1', 'token123')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/scm-providers/scm-1/token', { access_token: 'token123' })
    })
  })

  // ─── Module SCM Linking ───────────────────────────────────────────────────
  describe('module SCM linking', () => {
    it('linkModuleToSCM', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.linkModuleToSCM('m1', { provider_id: 'scm-1', repository_owner: 'org', repository_name: 'repo' })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/modules/m1/scm', expect.objectContaining({ provider_id: 'scm-1' }))
    })

    it('getModuleSCMInfo', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { linked: true } })
      await client.getModuleSCMInfo('m1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/modules/m1/scm')
    })

    it('updateModuleSCMLink', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateModuleSCMLink('m1', { auto_publish_enabled: true })
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/admin/modules/m1/scm', { auto_publish_enabled: true })
    })

    it('unlinkModuleFromSCM', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.unlinkModuleFromSCM('m1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/admin/modules/m1/scm')
    })

    it('triggerManualSync', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.triggerManualSync('m1', { tag_name: 'v1.0.0' })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/modules/m1/scm/sync', { tag_name: 'v1.0.0' })
    })

    it('triggerManualSync without data', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.triggerManualSync('m1')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/modules/m1/scm/sync', {})
    })

    it('getWebhookEvents', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { events: [] } })
      await client.getWebhookEvents('m1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/modules/m1/scm/events')
    })
  })

  // ─── Scanning ─────────────────────────────────────────────────────────────
  describe('scanning methods', () => {
    it('getScanningConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { enabled: true } })
      await client.getScanningConfig()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/scanning/config')
    })

    it('getScanningStats', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { total: 10 } })
      await client.getScanningStats()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/scanning/stats')
    })
  })

  // ─── Dashboard ────────────────────────────────────────────────────────────
  describe('dashboard methods', () => {
    it('getDashboardStats', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { modules: {} } })
      await client.getDashboardStats()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/stats/dashboard')
    })
  })

  // ─── Mirrors ──────────────────────────────────────────────────────────────
  describe('mirror methods', () => {
    it('listMirrors', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { mirrors: [{ id: 'mir-1' }] } })
      const result = await client.listMirrors()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/mirrors', { params: {} })
      expect(result).toHaveLength(1)
    })

    it('listMirrors enabledOnly', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { mirrors: [] } })
      await client.listMirrors(true)
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/mirrors', { params: { enabled: 'true' } })
    })

    it('getMirror', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 'mir-1' } })
      await client.getMirror('mir-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/mirrors/mir-1')
    })

    it('createMirror', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 'mir-2' } })
      await client.createMirror({ name: 'test', upstream_registry_url: 'https://registry.terraform.io' })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/mirrors', expect.objectContaining({ name: 'test' }))
    })

    it('updateMirror', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateMirror('mir-1', { name: 'updated' })
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/admin/mirrors/mir-1', { name: 'updated' })
    })

    it('deleteMirror', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteMirror('mir-1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/admin/mirrors/mir-1')
    })

    it('triggerMirrorSync', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.triggerMirrorSync('mir-1', { namespace: 'hashicorp' })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/mirrors/mir-1/sync', { namespace: 'hashicorp' })
    })

    it('getMirrorStatus', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { status: 'idle' } })
      await client.getMirrorStatus('mir-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/mirrors/mir-1/status')
    })

    it('getMirrorProviders', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { providers: ['hashicorp/aws'] } })
      const result = await client.getMirrorProviders('mir-1')
      expect(result).toEqual(['hashicorp/aws'])
    })
  })

  // ─── Roles ────────────────────────────────────────────────────────────────
  describe('role template methods', () => {
    it('listRoleTemplates', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: [{ id: 'r1' }] })
      const result = await client.listRoleTemplates()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/role-templates')
      expect(result).toHaveLength(1)
    })

    it('getRoleTemplate', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 'r1' } })
      await client.getRoleTemplate('r1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/role-templates/r1')
    })

    it('createRoleTemplate', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 'r2' } })
      await client.createRoleTemplate({ name: 'editor', display_name: 'Editor', scopes: ['write'] })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/role-templates', expect.objectContaining({ name: 'editor' }))
    })

    it('updateRoleTemplate', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateRoleTemplate('r1', { display_name: 'Updated' })
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/admin/role-templates/r1', { display_name: 'Updated' })
    })

    it('deleteRoleTemplate', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteRoleTemplate('r1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/admin/role-templates/r1')
    })
  })

  // ─── Approvals ────────────────────────────────────────────────────────────
  describe('approval methods', () => {
    it('listApprovalRequests', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: [{ id: 'a1' }] })
      const result = await client.listApprovalRequests({ status: 'pending' })
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/approvals', { params: { status: 'pending' } })
      expect(result).toHaveLength(1)
    })

    it('listApprovalRequests without filters', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: [] })
      await client.listApprovalRequests()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/approvals', { params: {} })
    })

    it('getApprovalRequest', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 'a1' } })
      await client.getApprovalRequest('a1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/approvals/a1')
    })

    it('createApprovalRequest', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 'a2' } })
      await client.createApprovalRequest({ mirror_config_id: 'mir-1', provider_namespace: 'hashicorp' })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/approvals', expect.objectContaining({ provider_namespace: 'hashicorp' }))
    })

    it('reviewApproval', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.reviewApproval('a1', { status: 'approved', notes: 'lgtm' })
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/admin/approvals/a1/review', { status: 'approved', notes: 'lgtm' })
    })
  })

  // ─── Mirror Policies ──────────────────────────────────────────────────────
  describe('mirror policy methods', () => {
    it('listMirrorPolicies', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: [{ id: 'p1' }] })
      await client.listMirrorPolicies()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/policies', { params: {} })
    })

    it('listMirrorPolicies with org', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: [] })
      await client.listMirrorPolicies('org-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/policies', { params: { organization_id: 'org-1' } })
    })

    it('getMirrorPolicy', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 'p1' } })
      await client.getMirrorPolicy('p1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/policies/p1')
    })

    it('createMirrorPolicy', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 'p2' } })
      await client.createMirrorPolicy({ name: 'allow-all', policy_type: 'allow' })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/policies', expect.objectContaining({ name: 'allow-all' }))
    })

    it('updateMirrorPolicy', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateMirrorPolicy('p1', { name: 'updated' })
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/admin/policies/p1', { name: 'updated' })
    })

    it('deleteMirrorPolicy', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteMirrorPolicy('p1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/admin/policies/p1')
    })

    it('evaluateMirrorPolicy', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { allowed: true } })
      await client.evaluateMirrorPolicy({ registry: 'https://registry.terraform.io', namespace: 'hashicorp', provider: 'aws' }, 'org-1')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/admin/policies/evaluate',
        { registry: 'https://registry.terraform.io', namespace: 'hashicorp', provider: 'aws' },
        { params: { organization_id: 'org-1' } },
      )
    })
  })

  // ─── Storage ──────────────────────────────────────────────────────────────
  describe('storage methods', () => {
    it('getSetupStatus', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { setup_required: false } })
      await client.getSetupStatus()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/setup/status')
    })

    it('listStorageConfigs', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: [{ id: 's1' }] })
      await client.listStorageConfigs()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/storage/configs')
    })

    it('getStorageConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 's1' } })
      await client.getStorageConfig('s1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/storage/configs/s1')
    })

    it('createStorageConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 's2' } })
      await client.createStorageConfig({ backend_type: 's3' } as never)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/storage/configs', expect.objectContaining({ backend_type: 's3' }))
    })

    it('updateStorageConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateStorageConfig('s1', { backend_type: 's3' } as never)
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/storage/configs/s1', expect.objectContaining({ backend_type: 's3' }))
    })

    it('deleteStorageConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteStorageConfig('s1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/storage/configs/s1')
    })

    it('activateStorageConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { message: 'activated' } })
      await client.activateStorageConfig('s1')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/storage/configs/s1/activate')
    })

    it('testStorageConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { success: true, message: 'ok' } })
      await client.testStorageConfig({ backend_type: 'local' } as never)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/storage/configs/test', expect.objectContaining({ backend_type: 'local' }))
    })

    it('planStorageMigration', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { items: 10 } })
      await client.planStorageMigration('s1', 's2')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/storage/migrations/plan', { source_config_id: 's1', target_config_id: 's2' })
    })

    it('startStorageMigration', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 'mig-1' } })
      await client.startStorageMigration('s1', 's2')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/storage/migrations', { source_config_id: 's1', target_config_id: 's2' })
    })

    it('getStorageMigration', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 'mig-1' } })
      await client.getStorageMigration('mig-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/storage/migrations/mig-1')
    })

    it('cancelStorageMigration', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 'mig-1', status: 'cancelled' } })
      await client.cancelStorageMigration('mig-1')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/storage/migrations/mig-1/cancel')
    })

    it('listStorageMigrations', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: [{ id: 'mig-1' }] })
      await client.listStorageMigrations()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/storage/migrations')
    })
  })

  // ─── Setup Wizard ─────────────────────────────────────────────────────────
  describe('setup wizard methods', () => {
    it('testOIDCConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { success: true } })
      await client.testOIDCConfig('tok', { issuer_url: 'https://auth.example.com', client_id: 'id', client_secret: 'secret' } as never)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/setup/oidc/test', expect.anything(), expect.objectContaining({ headers: { Authorization: 'SetupToken tok' } }))
    })

    it('saveOIDCConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.saveOIDCConfig('tok', { issuer_url: 'https://auth.example.com' } as never)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/setup/oidc', expect.anything(), expect.objectContaining({ headers: { Authorization: 'SetupToken tok' } }))
    })

    it('getAdminOIDCConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { issuer_url: 'https://auth.example.com' } })
      await client.getAdminOIDCConfig()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/oidc/config')
    })

    it('updateOIDCGroupMapping', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateOIDCGroupMapping({ group_claim_name: 'groups' } as never)
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/admin/oidc/group-mapping', expect.objectContaining({ group_claim_name: 'groups' }))
    })

    it('testSetupStorageConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { success: true } })
      await client.testSetupStorageConfig('tok', { backend_type: 'local' } as never)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/setup/storage/test', expect.anything(), expect.objectContaining({ headers: { Authorization: 'SetupToken tok' } }))
    })

    it('saveSetupStorageConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { message: 'saved' } })
      await client.saveSetupStorageConfig('tok', { backend_type: 'local' } as never)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/setup/storage', expect.anything(), expect.objectContaining({ headers: { Authorization: 'SetupToken tok' } }))
    })

    it('testScanningConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { success: true } })
      await client.testScanningConfig('tok', { enabled: true } as never)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/setup/scanning/test', expect.anything(), expect.objectContaining({ headers: { Authorization: 'SetupToken tok' } }))
    })

    it('saveScanningConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { message: 'saved' } })
      await client.saveScanningConfig('tok', { enabled: true } as never)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/setup/scanning', expect.anything(), expect.objectContaining({ headers: { Authorization: 'SetupToken tok' } }))
    })

    it('configureAdmin', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.configureAdmin('tok', { admin_email: 'admin@example.com' } as never)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/setup/admin', expect.anything(), expect.objectContaining({ headers: { Authorization: 'SetupToken tok' } }))
    })

    it('completeSetup', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { success: true } })
      await client.completeSetup('tok')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/setup/complete', {}, expect.objectContaining({ headers: { Authorization: 'SetupToken tok' } }))
    })
  })

  // ─── Terraform Mirrors Admin ──────────────────────────────────────────────
  describe('terraform mirror admin methods', () => {
    it('listPublicTerraformMirrorConfigs', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: [{ name: 'tf' }] })
      const result = await client.listPublicTerraformMirrorConfigs()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/terraform/binaries')
      expect(result).toHaveLength(1)
    })

    it('listPublicTerraformMirrorConfigs handles non-array', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: null })
      const result = await client.listPublicTerraformMirrorConfigs()
      expect(result).toEqual([])
    })

    it('listTerraformMirrorConfigs', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { configs: [] } })
      await client.listTerraformMirrorConfigs()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/terraform-mirrors')
    })

    it('createTerraformMirrorConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 'tc-1' } })
      await client.createTerraformMirrorConfig({ name: 'test', tool: 'terraform' } as never)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/terraform-mirrors', expect.objectContaining({ name: 'test' }))
    })

    it('getTerraformMirrorConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 'tc-1' } })
      await client.getTerraformMirrorConfig('tc-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/terraform-mirrors/tc-1')
    })

    it('getTerraformMirrorStatus', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { status: 'idle' } })
      await client.getTerraformMirrorStatus('tc-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/terraform-mirrors/tc-1/status')
    })

    it('updateTerraformMirrorConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateTerraformMirrorConfig('tc-1', { name: 'updated' } as never)
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/admin/terraform-mirrors/tc-1', expect.objectContaining({ name: 'updated' }))
    })

    it('deleteTerraformMirrorConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteTerraformMirrorConfig('tc-1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/admin/terraform-mirrors/tc-1')
    })

    it('triggerTerraformMirrorSync', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { message: 'started' } })
      await client.triggerTerraformMirrorSync('tc-1')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/terraform-mirrors/tc-1/sync', {})
    })

    it('listTerraformVersions', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { versions: [] } })
      await client.listTerraformVersions('tc-1', { synced: true })
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/terraform-mirrors/tc-1/versions', { params: { synced: 'true' } })
    })

    it('listTerraformVersions without filter', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { versions: [] } })
      await client.listTerraformVersions('tc-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/terraform-mirrors/tc-1/versions', { params: {} })
    })

    it('getTerraformVersion', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { version: '1.5.0' } })
      await client.getTerraformVersion('tc-1', '1.5.0')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/terraform-mirrors/tc-1/versions/1.5.0')
    })

    it('deleteTerraformVersion', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteTerraformVersion('tc-1', '1.5.0')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/admin/terraform-mirrors/tc-1/versions/1.5.0')
    })

    it('deprecateTerraformVersion', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deprecateTerraformVersion('tc-1', '1.5.0')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/terraform-mirrors/tc-1/versions/1.5.0/deprecate', {})
    })

    it('undeprecateTerraformVersion', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.undeprecateTerraformVersion('tc-1', '1.5.0')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/admin/terraform-mirrors/tc-1/versions/1.5.0/deprecate')
    })

    it('listTerraformVersionPlatforms returns array from data', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: [{ os: 'linux', arch: 'amd64' }] })
      const result = await client.listTerraformVersionPlatforms('tc-1', '1.5.0')
      expect(result).toHaveLength(1)
    })

    it('listTerraformVersionPlatforms returns platforms from nested', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { platforms: [{ os: 'linux' }] } })
      const result = await client.listTerraformVersionPlatforms('tc-1', '1.5.0')
      expect(result).toHaveLength(1)
    })

    it('getTerraformMirrorHistory', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { history: [] } })
      await client.getTerraformMirrorHistory('tc-1', 10)
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/terraform-mirrors/tc-1/history', { params: { limit: 10 } })
    })
  })

  // ─── Terraform Mirrors Public ─────────────────────────────────────────────
  describe('terraform mirror public methods', () => {
    it('listPublicTerraformVersions', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { versions: [] } })
      await client.listPublicTerraformVersions('terraform')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/terraform/binaries/terraform/versions')
    })

    it('getPublicLatestTerraformVersion', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { version: '1.9.0' } })
      await client.getPublicLatestTerraformVersion('terraform')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/terraform/binaries/terraform/versions/latest')
    })

    it('getPublicTerraformVersion', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { version: '1.5.0' } })
      await client.getPublicTerraformVersion('terraform', '1.5.0')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/terraform/binaries/terraform/versions/1.5.0')
    })

    it('getTerraformBinaryDownload', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { download_url: 'https://...' } })
      await client.getTerraformBinaryDownload('terraform', '1.5.0', 'linux', 'amd64')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/terraform/binaries/terraform/versions/1.5.0/linux/amd64')
    })
  })

  // ─── Audit Logs ───────────────────────────────────────────────────────────
  describe('audit log methods', () => {
    it('listAuditLogs with filters', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { logs: [], pagination: {} } })
      await client.listAuditLogs({ page: 1, per_page: 25, resource_type: 'module' })
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/audit-logs', { params: { page: 1, per_page: 25, resource_type: 'module' } })
    })

    it('getAuditLog', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 'log-1' } })
      await client.getAuditLog('log-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/audit-logs/log-1')
    })

    it('exportAuditLogsCSV creates download', async () => {
      const client = await getApiClient()
      const createElementSpy = vi.spyOn(document, 'createElement')
      const revokeURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => { })
      const createURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url')
      const clickSpy = vi.fn()
      createElementSpy.mockReturnValue({ click: clickSpy, href: '', download: '' } as unknown as HTMLAnchorElement)

      client.exportAuditLogsCSV([
        { id: 'l1', created_at: '2025-01-01', action: 'create', resource_type: 'module' } as never,
      ])

      expect(createURLSpy).toHaveBeenCalled()
      expect(clickSpy).toHaveBeenCalled()
      expect(revokeURLSpy).toHaveBeenCalledWith('blob:url')

      createElementSpy.mockRestore()
      revokeURLSpy.mockRestore()
      createURLSpy.mockRestore()
    })

    it('exportAuditLogsJSON creates download', async () => {
      const client = await getApiClient()
      const createElementSpy = vi.spyOn(document, 'createElement')
      const revokeURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => { })
      const createURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url')
      const clickSpy = vi.fn()
      createElementSpy.mockReturnValue({ click: clickSpy, href: '', download: '' } as unknown as HTMLAnchorElement)

      client.exportAuditLogsJSON([
        { id: 'l1', action: 'create' } as never,
      ])

      expect(createURLSpy).toHaveBeenCalled()
      expect(clickSpy).toHaveBeenCalled()

      createElementSpy.mockRestore()
      revokeURLSpy.mockRestore()
      createURLSpy.mockRestore()
    })
  })

  // ─── Phase 2: Enterprise Identity ──────────────────────────────────────────
  describe('enterprise identity methods', () => {
    it('getAuthProviders calls GET /api/v1/auth/providers', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { providers: [{ type: 'oidc', name: 'Corporate' }, { type: 'saml', name: 'Okta', id: 's1' }] },
        })
      const result = await client.getAuthProviders()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/auth/providers')
      expect(result.providers).toHaveLength(2)
      expect(result.providers[1].type).toBe('saml')
    })

    it('ldapLogin calls POST /api/v1/auth/ldap/login with credentials', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { token: 'ldap-jwt-token' },
        })
      const result = await client.ldapLogin('admin', 'secret')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/auth/ldap/login', { username: 'admin', password: 'secret' })
      expect(result.token).toBe('ldap-jwt-token')
    })

    it('getIdentityGroupMappings calls GET /api/v1/admin/identity/group-mappings', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { saml: { group_mappings: [] }, ldap: { group_mappings: [] } },
        })
      const result = await client.getIdentityGroupMappings()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/identity/group-mappings')
      expect(result).toHaveProperty('saml')
      expect(result).toHaveProperty('ldap')
    })

    it('getMTLSConfig calls GET /api/v1/admin/mtls/config', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { enabled: true, client_ca_file: '/ca.pem', mappings: [] },
        })
      const result = await client.getMTLSConfig()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/mtls/config')
      expect(result.enabled).toBe(true)
    })
  })

  // ─── Version Info ─────────────────────────────────────────────────────────
  describe('version info', () => {
    it('getVersionInfo', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { version: '1.0.0' } })
      const result = await client.getVersionInfo()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/version')
      expect(result.version).toBe('1.0.0')
    })
  })
})
