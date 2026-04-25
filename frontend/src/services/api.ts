import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'
import { addApiBreadcrumb } from './errorReporting'

// In dev mode, use empty baseURL to use relative paths (goes through Vite proxy)
// In production, use the configured URL or default to current origin
const API_BASE_URL = import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL || ''

// Only use mock responses when explicitly enabled (e.g., when backend is not running)
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true'

/** Read a cookie value by name. Returns empty string if not found. */
function getCookie(name: string): string {
  const match = document.cookie.match(
    new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'),
  )
  return match ? decodeURIComponent(match[1]) : ''
}

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      // Include cookies (HttpOnly auth cookie + CSRF cookie) on all requests.
      withCredentials: true,
      // Only validate successful status codes (2xx and 3xx)
      // This ensures errors are properly caught by the error interceptor
      validateStatus: (status) => status >= 200 && status < 400,
    })

    // Request interceptor to add CSRF token on mutating requests
    this.client.interceptors.request.use(
      (config) => {
        // For backward compatibility: if an auth token is in localStorage (migration
        // period), include it as a Bearer header. Once all sessions have migrated to
        // HttpOnly cookies this block can be removed.
        const legacyToken = localStorage.getItem('auth_token')
        if (legacyToken) {
          config.headers.Authorization = `Bearer ${legacyToken}`
        }

        // Add CSRF token header on mutating requests. The backend sets a non-HttpOnly
        // "tfr_csrf" cookie; we read it and echo it in X-CSRF-Token so the server can
        // validate the double-submit pattern.
        const method = (config.method || 'get').toUpperCase()
        if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
          const csrfToken = getCookie('tfr_csrf')
          if (csrfToken) {
            config.headers['X-CSRF-Token'] = csrfToken
          }
        }

        // Stamp the request start time for breadcrumb duration tracking
        ; (config as InternalAxiosRequestConfig & { _startTime?: number })._startTime = Date.now()
        return config
      },
      (error) => Promise.reject(error),
    )

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        return response
      },
      (error: AxiosError) => {
        // Only return mock data when explicitly enabled (for offline development)
        if (USE_MOCK_DATA) {
          return this.getMockResponse(error.config?.url || '')
        }

        if (error.response?.status === 401) {
          // SCM provider endpoints return 401 when the SCM OAuth token has expired or
          // been revoked — this is not a user session failure. Let the error propagate
          // so the calling component (e.g. RepositoryBrowser) can show the reconnect
          // prompt rather than wiping the user's session and redirecting to /login.
          const url = error.config?.url || ''
          const isSCMOAuthFailure =
            url.includes('/scm-providers/') &&
            (url.includes('/repositories') || url.includes('/tags') || url.includes('/branches'))

          if (!isSCMOAuthFailure) {
            // Only redirect when the user previously had an active session
            // (token or cached user). Fresh anonymous visitors receive 401 on
            // probing endpoints like /auth/me — this is expected and should
            // NOT trigger a redirect so public pages remain accessible.
            const hadSession =
              !!localStorage.getItem('auth_token') || !!localStorage.getItem('user')
            localStorage.removeItem('auth_token')
            localStorage.removeItem('user')
            if (hadSession) {
              window.location.href = '/login'
            }
          }
        }
        return Promise.reject(error)
      },
    )

    // Breadcrumb interceptor — records API calls for error reporting context
    this.client.interceptors.response.use(
      (response) => {
        const cfg = response.config as InternalAxiosRequestConfig & { _startTime?: number }
        const duration = cfg._startTime ? Date.now() - cfg._startTime : undefined
        addApiBreadcrumb(cfg.method ?? 'GET', cfg.url ?? '', response.status, duration)
        return response
      },
      (error: AxiosError) => {
        const cfg = (error.config ?? {}) as InternalAxiosRequestConfig & { _startTime?: number }
        const duration = cfg._startTime ? Date.now() - cfg._startTime : undefined
        addApiBreadcrumb(cfg.method ?? 'GET', cfg.url ?? '', error.response?.status, duration)
        return Promise.reject(error)
      },
    )
  }

  private getMockResponse(url: string): { data: unknown; status: number } {
    // Mock responses for development when backend is not available
    let mockData: { data: unknown } = { data: [] }

    if (url.includes('/modules') && !url.includes('/versions')) {
      mockData.data = { modules: [], meta: { total: 0, limit: 10, offset: 0 } }
    } else if (
      url.includes('/providers') &&
      !url.includes('/versions') &&
      !url.includes('/scm-providers')
    ) {
      mockData.data = { providers: [], meta: { total: 0, limit: 10, offset: 0 } }
    } else if (url.includes('/users')) {
      mockData.data = { users: [], meta: { total: 0, limit: 10, offset: 0 } }
    } else if (url.includes('/organizations')) {
      mockData.data = []
    } else if (url.includes('/apikeys')) {
      mockData.data = []
    } else if (url.includes('/scm-providers')) {
      mockData.data = []
    } else if (url.includes('/versions')) {
      mockData.data = { versions: [] }
    }

    return { data: mockData.data, status: 200 }
  }

  // Authentication

  /**
   * Fetch the list of available authentication providers from the backend.
   * Returns providers with type, name, and optional id (for SAML IdPs).
   */
  async getAuthProviders(): Promise<{
    providers: Array<{ type: string; name: string; id?: string }>
  }> {
    const response = await this.client.get('/api/v1/auth/providers')
    return response.data
  }

  async login(provider: string) {
    window.location.href = `${API_BASE_URL}/api/v1/auth/login?provider=${provider}`
  }

  /**
   * Authenticate via LDAP with username and password.
   * Returns a JWT token on success.
   */
  async ldapLogin(username: string, password: string): Promise<{ token: string }> {
    const response = await this.client.post('/api/v1/auth/ldap/login', { username, password })
    return response.data
  }

  /**
   * Redirects the browser to the backend /api/v1/auth/logout endpoint, which in turn
   * redirects to the OIDC provider's end_session_endpoint (if configured) so that the
   * IdP SSO session is terminated. This prevents silent re-authentication after logout.
   * The backend uses client_id (not id_token_hint) so nothing sensitive needs to be
   * stored client-side.
   */
  logout() {
    window.location.href = `${API_BASE_URL}/api/v1/auth/logout`
  }

  async refreshToken() {
    const response = await this.client.post('/api/v1/auth/refresh')
    return response.data
  }

  async getCurrentUser() {
    const response = await this.client.get('/api/v1/auth/me')
    return response.data.user
  }

  async getCurrentUserWithRole(): Promise<{
    user: import('../types').User
    role_template: import('../types').RoleTemplateInfo | null
    allowed_scopes: string[]
  }> {
    const response = await this.client.get('/api/v1/auth/me')
    return {
      user: response.data.user,
      role_template: response.data.role_template || null,
      allowed_scopes: response.data.allowed_scopes || [],
    }
  }

  // Modules
  async searchModules(options?: {
    query?: string
    limit?: number
    offset?: number
    page?: number
    per_page?: number
    sort?: string
    order?: string
  }) {
    const params: Record<string, string | number> = {}

    if (options?.query) params.q = options.query
    if (options?.limit) params.limit = options.limit
    if (options?.offset !== undefined) params.offset = options.offset
    if (options?.page) params.page = options.page
    if (options?.per_page) params.per_page = options.per_page
    if (options?.sort) params.sort = options.sort
    if (options?.order) params.order = options.order

    const response = await this.client.get('/api/v1/modules/search', { params })
    return response.data
  }

  async getModuleVersions(namespace: string, name: string, system: string) {
    const response = await this.client.get(`/v1/modules/${namespace}/${name}/${system}/versions`)
    return response.data
  }

  async createModuleRecord(data: {
    namespace: string
    name: string
    system: string
    description?: string
  }): Promise<{ id: string; namespace: string; name: string; system: string }> {
    const response = await this.client.post('/api/v1/admin/modules/create', data)
    return response.data
  }

  async uploadModule(
    formData: FormData,
    options?: { onUploadProgress?: (percent: number) => void },
  ) {
    const response = await this.client.post('/api/v1/modules', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: options?.onUploadProgress
        ? (event) => {
          if (event.total && event.total > 0) {
            const percent = Math.round((event.loaded / event.total) * 100)
            options.onUploadProgress?.(percent)
          }
        }
        : undefined,
    })
    return response.data
  }

  async getModule(namespace: string, name: string, system: string) {
    const response = await this.client.get(`/api/v1/modules/${namespace}/${name}/${system}`)
    return response.data
  }

  async deleteModule(namespace: string, name: string, system: string) {
    const response = await this.client.delete(`/api/v1/modules/${namespace}/${name}/${system}`)
    return response.data
  }

  async deleteModuleVersion(namespace: string, name: string, system: string, version: string) {
    const response = await this.client.delete(
      `/api/v1/modules/${namespace}/${name}/${system}/versions/${version}`,
    )
    return response.data
  }

  async reanalyzeModuleVersion(
    namespace: string,
    name: string,
    system: string,
    version: string,
  ) {
    const response = await this.client.post(
      `/api/v1/modules/${namespace}/${name}/${system}/versions/${version}/reanalyze`,
    )
    return response.data
  }

  async deprecateModuleVersion(
    namespace: string,
    name: string,
    system: string,
    version: string,
    message?: string,
    replacementSource?: string,
  ) {
    const body: Record<string, string> = {}
    if (message) body.message = message
    if (replacementSource) body.replacement_source = replacementSource
    const response = await this.client.post(
      `/api/v1/modules/${namespace}/${name}/${system}/versions/${version}/deprecate`,
      body,
    )
    return response.data
  }

  async undeprecateModuleVersion(namespace: string, name: string, system: string, version: string) {
    const response = await this.client.delete(
      `/api/v1/modules/${namespace}/${name}/${system}/versions/${version}/deprecate`,
    )
    return response.data
  }

  async deprecateModule(
    namespace: string,
    name: string,
    system: string,
    data: { message: string; successor_module_id?: string },
  ) {
    const response = await this.client.post(
      `/api/v1/modules/${namespace}/${name}/${system}/deprecate`,
      data,
    )
    return response.data
  }

  async undeprecateModule(namespace: string, name: string, system: string) {
    const response = await this.client.delete(
      `/api/v1/modules/${namespace}/${name}/${system}/deprecate`,
    )
    return response.data
  }

  // Providers
  async searchProviders(options?: {
    query?: string
    limit?: number
    offset?: number
    page?: number
    per_page?: number
    sort?: string
    order?: string
  }) {
    const params: Record<string, string | number> = {}

    if (options?.query) params.q = options.query
    if (options?.limit) params.limit = options.limit
    if (options?.offset !== undefined) params.offset = options.offset
    if (options?.page) params.page = options.page
    if (options?.per_page) params.per_page = options.per_page
    if (options?.sort) params.sort = options.sort
    if (options?.order) params.order = options.order

    const response = await this.client.get('/api/v1/providers/search', { params })
    return response.data
  }

  async getProviderVersions(namespace: string, type: string) {
    const response = await this.client.get(`/v1/providers/${namespace}/${type}/versions`)
    return response.data
  }

  async uploadProvider(
    formData: FormData,
    options?: { onUploadProgress?: (percent: number) => void },
  ) {
    const response = await this.client.post('/api/v1/providers', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: options?.onUploadProgress
        ? (event) => {
          if (event.total && event.total > 0) {
            const percent = Math.round((event.loaded / event.total) * 100)
            options.onUploadProgress?.(percent)
          }
        }
        : undefined,
    })
    return response.data
  }

  async getProvider(namespace: string, type: string) {
    const response = await this.client.get(`/api/v1/providers/${namespace}/${type}`)
    return response.data
  }

  async deleteProvider(namespace: string, type: string) {
    const response = await this.client.delete(`/api/v1/providers/${namespace}/${type}`)
    return response.data
  }

  async deleteProviderVersion(namespace: string, type: string, version: string) {
    const response = await this.client.delete(
      `/api/v1/providers/${namespace}/${type}/versions/${version}`,
    )
    return response.data
  }

  async deprecateProviderVersion(
    namespace: string,
    type: string,
    version: string,
    message?: string,
  ) {
    const response = await this.client.post(
      `/api/v1/providers/${namespace}/${type}/versions/${version}/deprecate`,
      message ? { message } : {},
    )
    return response.data
  }

  async undeprecateProviderVersion(namespace: string, type: string, version: string) {
    const response = await this.client.delete(
      `/api/v1/providers/${namespace}/${type}/versions/${version}/deprecate`,
    )
    return response.data
  }

  async getProviderDocs(
    namespace: string,
    type: string,
    version: string,
    category?: string,
    language?: string,
    limit?: number,
    offset?: number,
  ) {
    const params: Record<string, string | number> = {}
    if (category) params.category = category
    if (language) params.language = language
    if (limit !== undefined) params.limit = limit
    if (offset !== undefined) params.offset = offset
    const response = await this.client.get(
      `/api/v1/providers/${namespace}/${type}/versions/${version}/docs`,
      { params },
    )
    return response.data
  }

  async getProviderDocContent(
    namespace: string,
    type: string,
    version: string,
    category: string,
    slug: string,
  ) {
    const response = await this.client.get(
      `/api/v1/providers/${namespace}/${type}/versions/${version}/docs/${category}/${slug}`,
    )
    return response.data
  }

  // Helper to transform user from API format to frontend format
  private transformUser(user: Record<string, unknown>) {
    return {
      id: (user.ID || user.id) as string,
      email: (user.Email || user.email) as string,
      name: (user.Name || user.name) as string,
      oidc_sub: (user.OidcSub || user.oidc_sub) as string | undefined,
      role_template_id: (user.RoleTemplateID || user.role_template_id) as string | undefined,
      role_template_name: (user.RoleTemplateName || user.role_template_name) as string | undefined,
      role_template_display_name: (user.RoleTemplateDisplayName ||
        user.role_template_display_name) as string | undefined,
      created_at: (user.CreatedAt || user.created_at) as string,
      updated_at: (user.UpdatedAt || user.updated_at) as string,
    }
  }

  // Users
  async listUsers(page = 1, perPage = 20) {
    const response = await this.client.get('/api/v1/users', {
      params: { page, per_page: perPage },
    })
    const users = response.data.users || []
    return {
      users: users.map((user: Record<string, unknown>) => this.transformUser(user)),
      pagination: response.data.pagination,
    }
  }

  async searchUsers(query: string, page = 1, perPage = 20) {
    const response = await this.client.get('/api/v1/users/search', {
      params: { q: query, page, per_page: perPage },
    })
    const users = response.data.users || []
    return {
      users: users.map((user: Record<string, unknown>) => this.transformUser(user)),
      pagination: response.data.pagination,
    }
  }

  async getUser(id: string) {
    const response = await this.client.get(`/api/v1/users/${id}`)
    return this.transformUser(response.data.user)
  }

  async createUser(data: { email: string; name: string }) {
    const response = await this.client.post('/api/v1/users', data)
    return this.transformUser(response.data.user)
  }

  async updateUser(id: string, data: { name?: string; email?: string }) {
    const response = await this.client.put(`/api/v1/users/${id}`, data)
    return this.transformUser(response.data.user)
  }

  async deleteUser(id: string) {
    const response = await this.client.delete(`/api/v1/users/${id}`)
    return response.data
  }

  // Helper to transform organization from API format to frontend format
  private transformOrganization(org: Record<string, unknown>) {
    if (!org) {
      throw new Error('Cannot transform undefined organization')
    }
    return {
      id: org.id as string,
      name: org.name as string,
      display_name: org.display_name as string,
      created_at: org.created_at as string,
      updated_at: org.updated_at as string,
    }
  }

  // Organizations
  async listOrganizations(page = 1, perPage = 20) {
    const response = await this.client.get('/api/v1/organizations', {
      params: { page, per_page: perPage },
    })
    const orgs = response.data.organizations || []
    return orgs.map((org: Record<string, unknown>) => this.transformOrganization(org))
  }

  async searchOrganizations(query: string, page = 1, perPage = 20) {
    const response = await this.client.get('/api/v1/organizations/search', {
      params: { q: query, page, per_page: perPage },
    })
    const orgs = response.data.organizations || []
    return orgs.map((org: Record<string, unknown>) => this.transformOrganization(org))
  }

  async getOrganization(id: string) {
    const response = await this.client.get(`/api/v1/organizations/${id}`)
    return this.transformOrganization(response.data.organization)
  }

  async createOrganization(data: { name: string; display_name: string }) {
    const response = await this.client.post('/api/v1/organizations', data)
    // Check if the response contains an error
    if (response.status !== 200 && response.status !== 201) {
      throw new Error(response.data?.error || 'Failed to create organization')
    }
    if (!response.data.organization) {
      throw new Error('Invalid response from server: missing organization data')
    }
    return this.transformOrganization(response.data.organization)
  }

  async updateOrganization(
    id: string,
    data: { display_name: string; idp_type?: string | null; idp_name?: string | null },
  ) {
    const response = await this.client.put(`/api/v1/organizations/${id}`, data)
    return this.transformOrganization(response.data.organization)
  }

  async deleteOrganization(id: string) {
    const response = await this.client.delete(`/api/v1/organizations/${id}`)
    return response.data
  }

  async addOrganizationMember(orgId: string, data: { user_id: string; role_template_id?: string }) {
    const response = await this.client.post(`/api/v1/organizations/${orgId}/members`, data)
    return response.data
  }

  async updateOrganizationMember(
    orgId: string,
    userId: string,
    data: { role_template_id?: string },
  ) {
    const response = await this.client.put(`/api/v1/organizations/${orgId}/members/${userId}`, data)
    return response.data
  }

  async removeOrganizationMember(orgId: string, userId: string) {
    const response = await this.client.delete(`/api/v1/organizations/${orgId}/members/${userId}`)
    return response.data
  }

  async listOrganizationMembers(orgId: string) {
    const response = await this.client.get(`/api/v1/organizations/${orgId}/members`)
    return response.data.members || []
  }

  async getUserMemberships(userId: string) {
    const response = await this.client.get(`/api/v1/users/${userId}/memberships`)
    return response.data.memberships || []
  }

  // Self-access endpoint for current user's memberships (no special scope required)
  async getCurrentUserMemberships() {
    const response = await this.client.get('/api/v1/users/me/memberships')
    return response.data.memberships || []
  }

  // API Keys
  async listAPIKeys(organizationId?: string) {
    const response = await this.client.get('/api/v1/apikeys', {
      params: organizationId ? { organization_id: organizationId } : {},
    })

    const rawKeys = response.data?.keys || []

    // Normalize keys to frontend shape (support PascalCase from Go structs
    // or snake_case from explicit JSON mapping)
    const keys = rawKeys.map((k: Record<string, unknown>) => ({
      id: k.id || k.ID,
      user_id: k.user_id || k.UserID,
      user_name: k.user_name || k.UserName || null,
      organization_id: k.organization_id || k.OrganizationID,
      name: k.name || k.Name || '',
      description: k.description || k.Description || '',
      key_prefix: k.key_prefix || k.KeyPrefix || '',
      scopes: k.scopes || k.Scopes || [],
      expires_at: k.expires_at || k.ExpiresAt || null,
      last_used_at: k.last_used_at || k.LastUsedAt || null,
      created_at: k.created_at || k.CreatedAt || '',
    }))

    return keys
  }

  async createAPIKey(data: {
    name: string
    organization_id: string
    description?: string
    scopes: string[]
    expires_at?: string
  }) {
    const response = await this.client.post('/api/v1/apikeys', data)
    return response.data
  }

  async getAPIKey(id: string) {
    const response = await this.client.get(`/api/v1/apikeys/${id}`)
    return response.data
  }

  async updateAPIKey(id: string, data: { name?: string; scopes?: string[]; expires_at?: string }) {
    const response = await this.client.put(`/api/v1/apikeys/${id}`, data)
    return response.data
  }

  async deleteAPIKey(id: string) {
    const response = await this.client.delete(`/api/v1/apikeys/${id}`)
    return response.data
  }

  async rotateAPIKey(id: string, gracePeriodHours: number = 0) {
    const response = await this.client.post(`/api/v1/apikeys/${id}/rotate`, {
      grace_period_hours: gracePeriodHours,
    })
    return response.data
  }

  // SCM Provider Management
  async listSCMProviders(organizationId?: string) {
    const params = organizationId ? { organization_id: organizationId } : {}
    const response = await this.client.get('/api/v1/scm-providers', { params })
    return response.data
  }

  async createSCMProvider(data: {
    organization_id: string
    provider_type: string
    name: string
    base_url?: string | null
    client_id?: string
    client_secret?: string
    webhook_secret?: string
  }) {
    const response = await this.client.post('/api/v1/scm-providers', data)
    return response.data
  }

  async getSCMProvider(id: string) {
    const response = await this.client.get(`/api/v1/scm-providers/${id}`)
    return response.data
  }

  async updateSCMProvider(
    id: string,
    data: {
      name?: string
      base_url?: string | null
      tenant_id?: string | null
      client_id?: string
      client_secret?: string
      webhook_secret?: string
      is_active?: boolean
    },
  ) {
    const response = await this.client.put(`/api/v1/scm-providers/${id}`, data)
    return response.data
  }

  async deleteSCMProvider(id: string) {
    const response = await this.client.delete(`/api/v1/scm-providers/${id}`)
    return response.data
  }

  // SCM OAuth
  async initiateSCMOAuth(providerId: string) {
    const response = await this.client.get(`/api/v1/scm-providers/${providerId}/oauth/authorize`)
    return response.data
  }

  async refreshSCMToken(providerId: string) {
    const response = await this.client.post(`/api/v1/scm-providers/${providerId}/oauth/refresh`)
    return response.data
  }

  async getSCMTokenStatus(providerId: string): Promise<{
    connected: boolean
    connected_at?: string
    expires_at?: string | null
    token_type?: string
  }> {
    const response = await this.client.get(`/api/v1/scm-providers/${providerId}/oauth/token`)
    return response.data
  }

  async listSCMRepositories(providerId: string, search?: string) {
    const params = search ? { search } : {}
    const response = await this.client.get(`/api/v1/scm-providers/${providerId}/repositories`, {
      params,
    })
    return response.data
  }

  async listSCMRepositoryTags(providerId: string, owner: string, repo: string) {
    const response = await this.client.get(
      `/api/v1/scm-providers/${providerId}/repositories/${owner}/${repo}/tags`,
    )
    return response.data
  }

  async listSCMRepositoryBranches(providerId: string, owner: string, repo: string) {
    const response = await this.client.get(
      `/api/v1/scm-providers/${providerId}/repositories/${owner}/${repo}/branches`,
    )
    return response.data
  }

  async revokeSCMToken(providerId: string) {
    const response = await this.client.delete(`/api/v1/scm-providers/${providerId}/oauth/token`)
    return response.data
  }

  async saveSCMToken(providerId: string, accessToken: string) {
    const response = await this.client.post(`/api/v1/scm-providers/${providerId}/token`, {
      access_token: accessToken,
    })
    return response.data
  }

  // Module SCM Linking
  async linkModuleToSCM(
    moduleId: string,
    data: {
      provider_id: string
      repository_owner: string
      repository_name: string
      repository_path?: string
      default_branch?: string
      auto_publish_enabled?: boolean
      tag_pattern?: string
    },
  ) {
    const response = await this.client.post(`/api/v1/admin/modules/${moduleId}/scm`, data)
    return response.data
  }

  async getModuleSCMInfo(moduleId: string) {
    const response = await this.client.get(`/api/v1/admin/modules/${moduleId}/scm`)
    return response.data
  }

  async updateModuleSCMLink(
    moduleId: string,
    data: {
      repository_path?: string
      default_branch?: string
      auto_publish_enabled?: boolean
      tag_pattern?: string
    },
  ) {
    const response = await this.client.put(`/api/v1/admin/modules/${moduleId}/scm`, data)
    return response.data
  }

  async unlinkModuleFromSCM(moduleId: string) {
    const response = await this.client.delete(`/api/v1/admin/modules/${moduleId}/scm`)
    return response.data
  }

  async triggerManualSync(moduleId: string, data?: { tag_name?: string; commit_sha?: string }) {
    const response = await this.client.post(
      `/api/v1/admin/modules/${moduleId}/scm/sync`,
      data || {},
    )
    return response.data
  }

  async getWebhookEvents(moduleId: string) {
    const response = await this.client.get(`/api/v1/admin/modules/${moduleId}/scm/events`)
    return response.data
  }

  async updateModule(id: string, data: { description?: string; source?: string }) {
    const response = await this.client.put(`/api/v1/admin/modules/${id}`, data)
    return response.data
  }

  async getModuleScan(
    namespace: string,
    name: string,
    system: string,
    version: string,
  ): Promise<import('../types').ModuleScan> {
    const response = await this.client.get(
      `/api/v1/modules/${namespace}/${name}/${system}/versions/${version}/scan`,
    )
    return response.data
  }

  async getScanningConfig(): Promise<import('../types').ScanningConfig> {
    const response = await this.client.get('/api/v1/admin/scanning/config')
    return response.data
  }

  async getScanningStats(): Promise<import('../types').ScanningStats> {
    const response = await this.client.get('/api/v1/admin/scanning/stats')
    return response.data
  }

  async getModuleDocs(
    namespace: string,
    name: string,
    system: string,
    version: string,
  ): Promise<import('../types').ModuleDoc> {
    const response = await this.client.get(
      `/api/v1/modules/${namespace}/${name}/${system}/versions/${version}/docs`,
    )
    return response.data
  }

  // Dashboard Stats
  async getDashboardStats() {
    const response = await this.client.get('/api/v1/admin/stats/dashboard')
    return response.data
  }

  // Org Quotas
  async getOrgQuotas(orgId?: string) {
    const params = orgId ? { organization_id: orgId } : {}
    const response = await this.client.get('/api/v1/admin/quotas', { params })
    return (response.data.quotas ?? []) as import('../types').OrgQuota[]
  }

  // Mirror Management
  async listMirrors(enabledOnly = false) {
    const params = enabledOnly ? { enabled: 'true' } : {}
    const response = await this.client.get('/api/v1/admin/mirrors', { params })
    return response.data.mirrors || []
  }

  async getMirror(id: string) {
    const response = await this.client.get(`/api/v1/admin/mirrors/${id}`)
    return response.data
  }

  async createMirror(data: {
    name: string
    description?: string
    upstream_registry_url: string
    organization_id?: string
    namespace_filter?: string[]
    provider_filter?: string[]
    enabled?: boolean
    sync_interval_hours?: number
  }) {
    const response = await this.client.post('/api/v1/admin/mirrors', data)
    return response.data
  }

  async updateMirror(
    id: string,
    data: {
      name?: string
      description?: string
      upstream_registry_url?: string
      organization_id?: string
      namespace_filter?: string[]
      provider_filter?: string[]
      enabled?: boolean
      sync_interval_hours?: number
    },
  ) {
    const response = await this.client.put(`/api/v1/admin/mirrors/${id}`, data)
    return response.data
  }

  async deleteMirror(id: string) {
    const response = await this.client.delete(`/api/v1/admin/mirrors/${id}`)
    return response.data
  }

  async triggerMirrorSync(id: string, data?: { namespace?: string; provider_name?: string }) {
    const response = await this.client.post(`/api/v1/admin/mirrors/${id}/sync`, data || {})
    return response.data
  }

  async getMirrorStatus(id: string) {
    const response = await this.client.get(`/api/v1/admin/mirrors/${id}/status`)
    return response.data
  }

  async getMirrorProviders(id: string) {
    const response = await this.client.get(`/api/v1/admin/mirrors/${id}/providers`)
    return response.data.providers ?? []
  }

  // ============================================================================
  // Role Templates
  // ============================================================================

  async listRoleTemplates() {
    const response = await this.client.get('/api/v1/admin/role-templates')
    return response.data || []
  }

  async getRoleTemplate(id: string) {
    const response = await this.client.get(`/api/v1/admin/role-templates/${id}`)
    return response.data
  }

  async createRoleTemplate(data: {
    name: string
    display_name: string
    description?: string
    scopes: string[]
  }) {
    const response = await this.client.post('/api/v1/admin/role-templates', data)
    return response.data
  }

  async updateRoleTemplate(
    id: string,
    data: {
      name?: string
      display_name?: string
      description?: string
      scopes?: string[]
    },
  ) {
    const response = await this.client.put(`/api/v1/admin/role-templates/${id}`, data)
    return response.data
  }

  async deleteRoleTemplate(id: string) {
    const response = await this.client.delete(`/api/v1/admin/role-templates/${id}`)
    return response.data
  }

  // ============================================================================
  // Mirror Approval Requests
  // ============================================================================

  async listApprovalRequests(options?: { organization_id?: string; status?: string }) {
    const params: Record<string, string> = {}
    if (options?.organization_id) params.organization_id = options.organization_id
    if (options?.status) params.status = options.status
    const response = await this.client.get('/api/v1/admin/approvals', { params })
    return response.data || []
  }

  async getApprovalRequest(id: string) {
    const response = await this.client.get(`/api/v1/admin/approvals/${id}`)
    return response.data
  }

  async createApprovalRequest(data: {
    mirror_config_id: string
    provider_namespace: string
    provider_name?: string
    reason?: string
  }) {
    const response = await this.client.post('/api/v1/admin/approvals', data)
    return response.data
  }

  async reviewApproval(id: string, data: { status: 'approved' | 'rejected'; notes?: string }) {
    const response = await this.client.put(`/api/v1/admin/approvals/${id}/review`, data)
    return response.data
  }

  // ============================================================================
  // Mirror Policies
  // ============================================================================

  async listMirrorPolicies(organizationId?: string) {
    const params = organizationId ? { organization_id: organizationId } : {}
    const response = await this.client.get('/api/v1/admin/policies', { params })
    return response.data || []
  }

  async getMirrorPolicy(id: string) {
    const response = await this.client.get(`/api/v1/admin/policies/${id}`)
    return response.data
  }

  async createMirrorPolicy(data: {
    organization_id?: string
    name: string
    description?: string
    policy_type: 'allow' | 'deny'
    upstream_registry?: string
    namespace_pattern?: string
    provider_pattern?: string
    priority?: number
    is_active?: boolean
    requires_approval?: boolean
  }) {
    const response = await this.client.post('/api/v1/admin/policies', data)
    return response.data
  }

  async updateMirrorPolicy(
    id: string,
    data: {
      name?: string
      description?: string
      policy_type?: 'allow' | 'deny'
      upstream_registry?: string
      namespace_pattern?: string
      provider_pattern?: string
      priority?: number
      is_active?: boolean
      requires_approval?: boolean
    },
  ) {
    const response = await this.client.put(`/api/v1/admin/policies/${id}`, data)
    return response.data
  }

  async deleteMirrorPolicy(id: string) {
    const response = await this.client.delete(`/api/v1/admin/policies/${id}`)
    return response.data
  }

  async evaluateMirrorPolicy(
    data: {
      registry: string
      namespace: string
      provider: string
    },
    organizationId?: string,
  ) {
    const params = organizationId ? { organization_id: organizationId } : {}
    const response = await this.client.post('/api/v1/admin/policies/evaluate', data, { params })
    return response.data
  }

  // ============================================================================
  // Development-Only Endpoints (disabled in production)
  // ============================================================================

  async getDevStatus(): Promise<{ dev_mode: boolean; message?: string }> {
    const response = await this.client.get('/api/v1/dev/status')
    return response.data
  }

  async devLogin(): Promise<{ token: string; user: Record<string, unknown>; expires_in: number }> {
    const response = await this.client.post('/api/v1/dev/login')
    return response.data
  }

  async listUsersForImpersonation(): Promise<{
    users: Array<{
      id: string
      email: string
      name: string
      primary_role: string
    }>
    dev_mode: boolean
  }> {
    const response = await this.client.get('/api/v1/dev/users')
    return response.data
  }

  async impersonateUser(userId: string): Promise<{
    token: string
    user: {
      id: string
      email: string
      name: string
    }
    message: string
  }> {
    const response = await this.client.post(`/api/v1/dev/impersonate/${userId}`)
    return response.data
  }

  // ============================================================================
  // Setup Wizard
  // ============================================================================

  /**
   * Creates an Axios instance that uses a setup token for authentication
   * instead of the normal JWT bearer token.
   */
  private setupRequest(setupToken: string) {
    return {
      headers: { Authorization: `SetupToken ${setupToken}` },
    }
  }

  async validateSetupToken(
    setupToken: string,
  ): Promise<import('../types').SetupValidateTokenResponse> {
    const response = await this.client.post(
      '/api/v1/setup/validate-token',
      {},
      this.setupRequest(setupToken),
    )
    return response.data
  }

  async testOIDCConfig(
    setupToken: string,
    data: import('../types').OIDCConfigInput,
  ): Promise<import('../types').SetupTestResult> {
    const response = await this.client.post(
      '/api/v1/setup/oidc/test',
      data,
      this.setupRequest(setupToken),
    )
    return response.data
  }

  async saveOIDCConfig(
    setupToken: string,
    data: import('../types').OIDCConfigInput,
  ): Promise<import('../types').OIDCConfigResponse> {
    const response = await this.client.post(
      '/api/v1/setup/oidc',
      data,
      this.setupRequest(setupToken),
    )
    return response.data
  }

  async testLDAPConfig(
    setupToken: string,
    data: import('../types').LDAPConfigInput,
  ): Promise<import('../types').SetupTestResult> {
    const response = await this.client.post(
      '/api/v1/setup/ldap/test',
      data,
      this.setupRequest(setupToken),
    )
    return response.data
  }

  async saveLDAPConfig(
    setupToken: string,
    data: import('../types').LDAPConfigInput,
  ): Promise<{ message: string; host: string; port: number }> {
    const response = await this.client.post(
      '/api/v1/setup/ldap',
      data,
      this.setupRequest(setupToken),
    )
    return response.data
  }

  // Admin OIDC config endpoints

  async getAdminOIDCConfig(): Promise<import('../types').OIDCConfigResponse> {
    const response = await this.client.get('/api/v1/admin/oidc/config')
    return response.data
  }

  async updateOIDCGroupMapping(
    data: import('../types').OIDCGroupMappingInput,
  ): Promise<import('../types').OIDCConfigResponse> {
    const response = await this.client.put('/api/v1/admin/oidc/group-mapping', data)
    return response.data
  }

  /**
   * Fetch SAML + LDAP group mapping configuration (read-only, from server config).
   */
  async getIdentityGroupMappings(): Promise<import('../types').IdentityGroupMappings> {
    const response = await this.client.get('/api/v1/admin/identity/group-mappings')
    return response.data
  }

  /**
   * Fetch mTLS certificate mapping configuration (read-only, from server config).
   */
  async getMTLSConfig(): Promise<import('../types').MTLSConfigResponse> {
    const response = await this.client.get('/api/v1/admin/mtls/config')
    return response.data
  }

  async testSetupStorageConfig(
    setupToken: string,
    data: import('../types').StorageConfigInput,
  ): Promise<import('../types').SetupTestResult> {
    const response = await this.client.post(
      '/api/v1/setup/storage/test',
      data,
      this.setupRequest(setupToken),
    )
    return response.data
  }

  async saveSetupStorageConfig(
    setupToken: string,
    data: import('../types').StorageConfigInput,
  ): Promise<{ message: string; config: import('../types').StorageConfigResponse }> {
    const response = await this.client.post(
      '/api/v1/setup/storage',
      data,
      this.setupRequest(setupToken),
    )
    return response.data
  }

  async testScanningConfig(
    setupToken: string,
    data: import('../types').ScanningConfigInput,
  ): Promise<import('../types').ScanningTestResult> {
    const response = await this.client.post(
      '/api/v1/setup/scanning/test',
      data,
      this.setupRequest(setupToken),
    )
    return response.data
  }

  async saveScanningConfig(
    setupToken: string,
    data: import('../types').ScanningConfigInput,
  ): Promise<{ message: string }> {
    const response = await this.client.post(
      '/api/v1/setup/scanning',
      data,
      this.setupRequest(setupToken),
    )
    return response.data
  }

  async installScanningTool(
    setupToken: string,
    data: import('../types').ScanningInstallRequest,
  ): Promise<import('../types').ScanningInstallResult> {
    const response = await this.client.post(
      '/api/v1/setup/scanning/install',
      data,
      this.setupRequest(setupToken),
    )
    return response.data
  }

  async configureAdmin(
    setupToken: string,
    data: import('../types').ConfigureAdminInput,
  ): Promise<import('../types').ConfigureAdminResponse> {
    const response = await this.client.post(
      '/api/v1/setup/admin',
      data,
      this.setupRequest(setupToken),
    )
    return response.data
  }

  async completeSetup(setupToken: string): Promise<import('../types').CompleteSetupResponse> {
    const response = await this.client.post(
      '/api/v1/setup/complete',
      {},
      this.setupRequest(setupToken),
    )
    return response.data
  }

  // ============================================================================
  // Storage Configuration
  // ============================================================================

  async getSetupStatus(): Promise<import('../types').SetupStatus> {
    const response = await this.client.get('/api/v1/setup/status')
    return response.data
  }

  async getActiveStorageConfig(): Promise<import('../types').StorageConfigResponse> {
    const response = await this.client.get('/api/v1/storage/config')
    return response.data
  }

  async listStorageConfigs(): Promise<import('../types').StorageConfigResponse[]> {
    const response = await this.client.get('/api/v1/storage/configs')
    return response.data
  }

  async getStorageConfig(id: string): Promise<import('../types').StorageConfigResponse> {
    const response = await this.client.get(`/api/v1/storage/configs/${id}`)
    return response.data
  }

  async createStorageConfig(
    data: import('../types').StorageConfigInput,
  ): Promise<import('../types').StorageConfigResponse> {
    const response = await this.client.post('/api/v1/storage/configs', data)
    return response.data
  }

  async updateStorageConfig(
    id: string,
    data: import('../types').StorageConfigInput,
  ): Promise<import('../types').StorageConfigResponse> {
    const response = await this.client.put(`/api/v1/storage/configs/${id}`, data)
    return response.data
  }

  async deleteStorageConfig(id: string): Promise<void> {
    await this.client.delete(`/api/v1/storage/configs/${id}`)
  }

  async activateStorageConfig(
    id: string,
  ): Promise<{ message: string; config: import('../types').StorageConfigResponse }> {
    const response = await this.client.post(`/api/v1/storage/configs/${id}/activate`)
    return response.data
  }

  async testStorageConfig(
    data: import('../types').StorageConfigInput,
  ): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/api/v1/storage/configs/test', data)
    return response.data
  }

  // ============================================================================
  // Storage Migrations
  // ============================================================================

  async planStorageMigration(
    sourceId: string,
    targetId: string,
  ): Promise<import('../types').MigrationPlan> {
    const response = await this.client.post('/api/v1/admin/storage/migrations/plan', {
      source_config_id: sourceId,
      target_config_id: targetId,
    })
    return response.data
  }

  async startStorageMigration(
    sourceId: string,
    targetId: string,
  ): Promise<import('../types').StorageMigration> {
    const response = await this.client.post('/api/v1/admin/storage/migrations', {
      source_config_id: sourceId,
      target_config_id: targetId,
    })
    return response.data
  }

  async getStorageMigration(id: string): Promise<import('../types').StorageMigration> {
    const response = await this.client.get(`/api/v1/admin/storage/migrations/${id}`)
    return response.data
  }

  async cancelStorageMigration(id: string): Promise<import('../types').StorageMigration> {
    const response = await this.client.post(`/api/v1/admin/storage/migrations/${id}/cancel`)
    return response.data
  }

  async listStorageMigrations(): Promise<import('../types').StorageMigration[]> {
    const response = await this.client.get('/api/v1/admin/storage/migrations')
    return response.data
  }

  // ============================================================================
  // Terraform Binary Mirror — Public list (no auth required)
  // ============================================================================

  async listPublicTerraformMirrorConfigs(): Promise<
    { name: string; description?: string | null; tool: string }[]
  > {
    const response = await this.client.get('/terraform/binaries')
    return Array.isArray(response.data) ? response.data : []
  }

  // ============================================================================
  // Terraform Binary Mirror — Admin Endpoints (multi-config)
  // All config-scoped endpoints take a configId (UUID) as their first argument.
  // ============================================================================

  async listTerraformMirrorConfigs(): Promise<
    import('../types/terraform_mirror').TerraformMirrorConfigListResponse
  > {
    const response = await this.client.get('/api/v1/admin/terraform-mirrors')
    return response.data
  }

  async createTerraformMirrorConfig(
    data: import('../types/terraform_mirror').CreateTerraformMirrorConfigRequest,
  ): Promise<import('../types/terraform_mirror').TerraformMirrorConfig> {
    const response = await this.client.post('/api/v1/admin/terraform-mirrors', data)
    return response.data
  }

  async getTerraformMirrorConfig(
    configId: string,
  ): Promise<import('../types/terraform_mirror').TerraformMirrorConfig> {
    const response = await this.client.get(`/api/v1/admin/terraform-mirrors/${configId}`)
    return response.data
  }

  async getTerraformMirrorStatus(
    configId: string,
  ): Promise<import('../types/terraform_mirror').TerraformMirrorStatusResponse> {
    const response = await this.client.get(`/api/v1/admin/terraform-mirrors/${configId}/status`)
    return response.data
  }

  async updateTerraformMirrorConfig(
    configId: string,
    data: import('../types/terraform_mirror').UpdateTerraformMirrorConfigRequest,
  ): Promise<import('../types/terraform_mirror').TerraformMirrorConfig> {
    const response = await this.client.put(`/api/v1/admin/terraform-mirrors/${configId}`, data)
    return response.data
  }

  async deleteTerraformMirrorConfig(configId: string): Promise<void> {
    await this.client.delete(`/api/v1/admin/terraform-mirrors/${configId}`)
  }

  async triggerTerraformMirrorSync(configId: string): Promise<{ message: string }> {
    const response = await this.client.post(`/api/v1/admin/terraform-mirrors/${configId}/sync`, {})
    return response.data
  }

  async listTerraformVersions(
    configId: string,
    options?: { synced?: boolean },
  ): Promise<import('../types/terraform_mirror').TerraformVersionListResponse> {
    const params: Record<string, string> = {}
    if (options?.synced !== undefined) params.synced = String(options.synced)
    const response = await this.client.get(`/api/v1/admin/terraform-mirrors/${configId}/versions`, {
      params,
    })
    return response.data
  }

  async getTerraformVersion(
    configId: string,
    version: string,
  ): Promise<import('../types/terraform_mirror').TerraformVersion> {
    const response = await this.client.get(
      `/api/v1/admin/terraform-mirrors/${configId}/versions/${version}`,
    )
    return response.data
  }

  async deleteTerraformVersion(configId: string, version: string): Promise<void> {
    await this.client.delete(`/api/v1/admin/terraform-mirrors/${configId}/versions/${version}`)
  }

  async deprecateTerraformVersion(configId: string, version: string): Promise<void> {
    await this.client.post(
      `/api/v1/admin/terraform-mirrors/${configId}/versions/${version}/deprecate`,
      {},
    )
  }

  async undeprecateTerraformVersion(configId: string, version: string): Promise<void> {
    await this.client.delete(
      `/api/v1/admin/terraform-mirrors/${configId}/versions/${version}/deprecate`,
    )
  }

  async listTerraformVersionPlatforms(
    configId: string,
    version: string,
  ): Promise<import('../types/terraform_mirror').TerraformVersionPlatform[]> {
    const response = await this.client.get(
      `/api/v1/admin/terraform-mirrors/${configId}/versions/${version}/platforms`,
    )
    return Array.isArray(response.data) ? response.data : (response.data.platforms ?? [])
  }

  async getTerraformMirrorHistory(
    configId: string,
    limit = 20,
  ): Promise<import('../types/terraform_mirror').TerraformSyncHistoryListResponse> {
    const response = await this.client.get(`/api/v1/admin/terraform-mirrors/${configId}/history`, {
      params: { limit },
    })
    return response.data
  }

  // ============================================================================
  // Terraform Binary Mirror — Public Endpoints (no auth required)
  // The :name segment identifies the mirror config by its human-readable name.
  // ============================================================================

  async listPublicTerraformVersions(
    name: string,
  ): Promise<import('../types/terraform_mirror').TerraformVersionListResponse> {
    const response = await this.client.get(`/terraform/binaries/${name}/versions`)
    return response.data
  }

  async getPublicLatestTerraformVersion(
    name: string,
  ): Promise<import('../types/terraform_mirror').TerraformVersion> {
    const response = await this.client.get(`/terraform/binaries/${name}/versions/latest`)
    return response.data
  }

  async getPublicTerraformVersion(
    name: string,
    version: string,
  ): Promise<import('../types/terraform_mirror').TerraformVersion> {
    const response = await this.client.get(`/terraform/binaries/${name}/versions/${version}`)
    return response.data
  }

  async getTerraformBinaryDownload(
    name: string,
    version: string,
    os: string,
    arch: string,
  ): Promise<import('../types/terraform_mirror').TerraformBinaryDownloadResponse> {
    const response = await this.client.get(
      `/terraform/binaries/${name}/versions/${version}/${os}/${arch}`,
    )
    return response.data
  }

  // ============================================================================
  // Audit Logs
  // ============================================================================

  async listAuditLogs(opts?: {
    page?: number
    per_page?: number
    action?: string
    resource_type?: string
    user_id?: string
    user_email?: string
    start_date?: string
    end_date?: string
  }): Promise<import('../types').AuditLogListResponse> {
    const response = await this.client.get('/api/v1/admin/audit-logs', { params: opts })
    return response.data
  }

  async getAuditLog(id: string): Promise<import('../types').AuditLog> {
    const response = await this.client.get(`/api/v1/admin/audit-logs/${id}`)
    return response.data
  }

  exportAuditLogsCSV(logs: import('../types').AuditLog[]): void {
    const header = [
      'id',
      'created_at',
      'action',
      'resource_type',
      'resource_id',
      'user_email',
      'user_name',
      'organization_id',
      'ip_address',
    ]
    const rows = logs.map((l) =>
      [
        l.id,
        l.created_at,
        l.action,
        l.resource_type ?? '',
        l.resource_id ?? '',
        l.user_email ?? '',
        l.user_name ?? '',
        l.organization_id ?? '',
        l.ip_address ?? '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    )
    const csv = [header.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  exportAuditLogsJSON(logs: import('../types').AuditLog[]): void {
    const json = JSON.stringify(logs, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ============================================================================
  // Version
  // ============================================================================

  async getVersionInfo(): Promise<import('../types').VersionInfo> {
    const response = await this.client.get('/version')
    return response.data
  }

  // ============================================================================
  // UI Theme (whitelabel)
  // ============================================================================

  /**
   * Fetch the runtime whitelabel theme config from the backend.
   * Returns null if the endpoint does not exist (pre-phase-5 backends) so
   * callers can gracefully fall back to built-in defaults.
   */
  async getUITheme(): Promise<import('../types').UIThemeConfig | null> {
    try {
      const response = await this.client.get('/api/v1/ui/theme')
      return response.data as import('../types').UIThemeConfig
    } catch {
      // 404 means the backend hasn't implemented the endpoint yet; treat as no override.
      return null
    }
  }

  async updateAdminUITheme(config: import('../types').UIThemeConfig): Promise<import('../types').UIThemeConfig> {
    const response = await this.client.put('/api/v1/admin/ui-theme', config)
    return response.data as import('../types').UIThemeConfig
  }
}

const apiClient = new ApiClient()
export default apiClient
