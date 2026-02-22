import axios, { AxiosInstance, AxiosError } from 'axios';

// In dev mode, use empty baseURL to use relative paths (goes through Vite proxy)
// In production, use the configured URL or default to current origin
const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');

// Only use mock responses when explicitly enabled (e.g., when backend is not running)
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      // Only validate successful status codes (2xx and 3xx)
      // This ensures errors are properly caught by the error interceptor
      validateStatus: (status) => status >= 200 && status < 400,
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      (error: AxiosError) => {
        // Only return mock data when explicitly enabled (for offline development)
        if (USE_MOCK_DATA) {
          return this.getMockResponse(error.config?.url || '');
        }

        if (error.response?.status === 401) {
          // Only redirect to login if user was authenticated (has token)
          const token = localStorage.getItem('auth_token');
          if (token) {
            // Token expired or invalid
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
          // If no token, allow the error to propagate (for public endpoints)
        }
        return Promise.reject(error);
      }
    );
  }

  private getMockResponse(url: string): any {
    // Mock responses for development when backend is not available
    let mockData: any = { data: [] };

    if (url.includes('/modules') && !url.includes('/versions')) {
      mockData.data = { modules: [], meta: { total: 0, limit: 10, offset: 0 } };
    } else if (url.includes('/providers') && !url.includes('/versions') && !url.includes('/scm-providers')) {
      mockData.data = { providers: [], meta: { total: 0, limit: 10, offset: 0 } };
    } else if (url.includes('/users')) {
      mockData.data = { users: [], meta: { total: 0, limit: 10, offset: 0 } };
    } else if (url.includes('/organizations')) {
      mockData.data = [];
    } else if (url.includes('/apikeys')) {
      mockData.data = [];
    } else if (url.includes('/scm-providers')) {
      mockData.data = [];
    } else if (url.includes('/versions')) {
      mockData.data = { versions: [] };
    }

    return { data: mockData.data, status: 200 };
  }

  // Authentication
  async login(provider: 'oidc' | 'azuread') {
    window.location.href = `${API_BASE_URL}/api/v1/auth/login?provider=${provider}`;
  }

  async refreshToken() {
    const response = await this.client.post('/api/v1/auth/refresh');
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.client.get('/api/v1/auth/me');
    return response.data.user;
  }

  async getCurrentUserWithRole(): Promise<{
    user: import('../types').User;
    role_template: import('../types').RoleTemplateInfo | null;
    allowed_scopes: string[];
  }> {
    const response = await this.client.get('/api/v1/auth/me');
    return {
      user: response.data.user,
      role_template: response.data.role_template || null,
      allowed_scopes: response.data.allowed_scopes || [],
    };
  }

  // Modules
  async searchModules(options?: { query?: string; limit?: number; offset?: number; page?: number; per_page?: number }) {
    const params: any = {};
    
    if (options?.query) params.q = options.query;
    if (options?.limit) params.limit = options.limit;
    if (options?.offset) params.offset = options.offset;
    if (options?.page) params.page = options.page;
    if (options?.per_page) params.per_page = options.per_page;
    
    const response = await this.client.get('/api/v1/modules/search', { params });
    return response.data;
  }

  async getModuleVersions(namespace: string, name: string, system: string) {
    const response = await this.client.get(
      `/v1/modules/${namespace}/${name}/${system}/versions`
    );
    return response.data;
  }

  async createModuleRecord(data: {
    namespace: string;
    name: string;
    system: string;
    description?: string;
  }): Promise<{ id: string; namespace: string; name: string; system: string }> {
    const response = await this.client.post('/api/v1/admin/modules/create', data);
    return response.data;
  }

  async uploadModule(formData: FormData) {
    const response = await this.client.post('/api/v1/modules', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getModule(namespace: string, name: string, system: string) {
    const response = await this.client.get(`/api/v1/modules/${namespace}/${name}/${system}`);
    return response.data;
  }

  async deleteModule(namespace: string, name: string, system: string) {
    const response = await this.client.delete(`/api/v1/modules/${namespace}/${name}/${system}`);
    return response.data;
  }

  async deleteModuleVersion(namespace: string, name: string, system: string, version: string) {
    const response = await this.client.delete(`/api/v1/modules/${namespace}/${name}/${system}/versions/${version}`);
    return response.data;
  }

  async deprecateModuleVersion(namespace: string, name: string, system: string, version: string, message?: string) {
    const response = await this.client.post(
      `/api/v1/modules/${namespace}/${name}/${system}/versions/${version}/deprecate`,
      message ? { message } : {}
    );
    return response.data;
  }

  async undeprecateModuleVersion(namespace: string, name: string, system: string, version: string) {
    const response = await this.client.delete(`/api/v1/modules/${namespace}/${name}/${system}/versions/${version}/deprecate`);
    return response.data;
  }

  // Providers
  async searchProviders(options?: { query?: string; limit?: number; offset?: number; page?: number; per_page?: number }) {
    const params: any = {};
    
    if (options?.query) params.q = options.query;
    if (options?.limit) params.limit = options.limit;
    if (options?.offset) params.offset = options.offset;
    if (options?.page) params.page = options.page;
    if (options?.per_page) params.per_page = options.per_page;
    
    const response = await this.client.get('/api/v1/providers/search', { params });
    return response.data;
  }

  async getProviderVersions(namespace: string, type: string) {
    const response = await this.client.get(
      `/v1/providers/${namespace}/${type}/versions`
    );
    return response.data;
  }

  async uploadProvider(formData: FormData) {
    const response = await this.client.post('/api/v1/providers', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getProvider(namespace: string, type: string) {
    const response = await this.client.get(`/api/v1/providers/${namespace}/${type}`);
    return response.data;
  }

  async deleteProvider(namespace: string, type: string) {
    const response = await this.client.delete(`/api/v1/providers/${namespace}/${type}`);
    return response.data;
  }

  async deleteProviderVersion(namespace: string, type: string, version: string) {
    const response = await this.client.delete(`/api/v1/providers/${namespace}/${type}/versions/${version}`);
    return response.data;
  }

  async deprecateProviderVersion(namespace: string, type: string, version: string, message?: string) {
    const response = await this.client.post(
      `/api/v1/providers/${namespace}/${type}/versions/${version}/deprecate`,
      message ? { message } : {}
    );
    return response.data;
  }

  async undeprecateProviderVersion(namespace: string, type: string, version: string) {
    const response = await this.client.delete(`/api/v1/providers/${namespace}/${type}/versions/${version}/deprecate`);
    return response.data;
  }

  // Helper to transform user from API format to frontend format
  private transformUser(user: any) {
    return {
      id: user.ID || user.id,
      email: user.Email || user.email,
      name: user.Name || user.name,
      oidc_sub: user.OidcSub || user.oidc_sub,
      role_template_id: user.RoleTemplateID || user.role_template_id,
      role_template_name: user.RoleTemplateName || user.role_template_name,
      role_template_display_name: user.RoleTemplateDisplayName || user.role_template_display_name,
      created_at: user.CreatedAt || user.created_at,
      updated_at: user.UpdatedAt || user.updated_at,
    };
  }

  // Users
  async listUsers(page = 1, perPage = 20) {
    const response = await this.client.get('/api/v1/users', {
      params: { page, per_page: perPage },
    });
    const users = response.data.users || [];
    return {
      users: users.map((user: any) => this.transformUser(user)),
      pagination: response.data.pagination,
    };
  }

  async searchUsers(query: string, page = 1, perPage = 20) {
    const response = await this.client.get('/api/v1/users/search', {
      params: { q: query, page, per_page: perPage },
    });
    const users = response.data.users || [];
    return {
      users: users.map((user: any) => this.transformUser(user)),
      pagination: response.data.pagination,
    };
  }

  async getUser(id: string) {
    const response = await this.client.get(`/api/v1/users/${id}`);
    return this.transformUser(response.data.user);
  }

  async createUser(data: { email: string; name: string }) {
    const response = await this.client.post('/api/v1/users', data);
    return this.transformUser(response.data.user);
  }

  async updateUser(id: string, data: { name?: string; email?: string }) {
    const response = await this.client.put(`/api/v1/users/${id}`, data);
    return this.transformUser(response.data.user);
  }

  async deleteUser(id: string) {
    const response = await this.client.delete(`/api/v1/users/${id}`);
    return response.data;
  }

  // Helper to transform organization from API format to frontend format
  private transformOrganization(org: any) {
    if (!org) {
      throw new Error('Cannot transform undefined organization');
    }
    return {
      id: org.ID,
      name: org.Name,
      display_name: org.DisplayName,
      created_at: org.CreatedAt,
      updated_at: org.UpdatedAt,
    };
  }

  // Organizations
  async listOrganizations(page = 1, perPage = 20) {
    const response = await this.client.get('/api/v1/organizations', {
      params: { page, per_page: perPage },
    });
    const orgs = response.data.organizations || [];
    return orgs.map((org: any) => this.transformOrganization(org));
  }

  async searchOrganizations(query: string, page = 1, perPage = 20) {
    const response = await this.client.get('/api/v1/organizations/search', {
      params: { q: query, page, per_page: perPage },
    });
    const orgs = response.data.organizations || [];
    return orgs.map((org: any) => this.transformOrganization(org));
  }

  async getOrganization(id: string) {
    const response = await this.client.get(`/api/v1/organizations/${id}`);
    return this.transformOrganization(response.data.organization);
  }

  async createOrganization(data: { name: string; display_name: string }) {
    const response = await this.client.post('/api/v1/organizations', data);
    // Check if the response contains an error
    if (response.status !== 200 && response.status !== 201) {
      throw new Error(response.data?.error || 'Failed to create organization');
    }
    if (!response.data.organization) {
      throw new Error('Invalid response from server: missing organization data');
    }
    return this.transformOrganization(response.data.organization);
  }

  async updateOrganization(id: string, data: { display_name: string }) {
    const response = await this.client.put(`/api/v1/organizations/${id}`, data);
    return this.transformOrganization(response.data.organization);
  }

  async deleteOrganization(id: string) {
    const response = await this.client.delete(`/api/v1/organizations/${id}`);
    return response.data;
  }

  async addOrganizationMember(orgId: string, data: { user_id: string; role_template_id?: string }) {
    const response = await this.client.post(
      `/api/v1/organizations/${orgId}/members`,
      data
    );
    return response.data;
  }

  async updateOrganizationMember(
    orgId: string,
    userId: string,
    data: { role_template_id?: string }
  ) {
    const response = await this.client.put(
      `/api/v1/organizations/${orgId}/members/${userId}`,
      data
    );
    return response.data;
  }

  async removeOrganizationMember(orgId: string, userId: string) {
    const response = await this.client.delete(
      `/api/v1/organizations/${orgId}/members/${userId}`
    );
    return response.data;
  }

  async listOrganizationMembers(orgId: string) {
    const response = await this.client.get(`/api/v1/organizations/${orgId}/members`);
    return response.data.members || [];
  }

  async getUserMemberships(userId: string) {
    const response = await this.client.get(`/api/v1/users/${userId}/memberships`);
    return response.data.memberships || [];
  }

  // Self-access endpoint for current user's memberships (no special scope required)
  async getCurrentUserMemberships() {
    const response = await this.client.get('/api/v1/users/me/memberships');
    return response.data.memberships || [];
  }

  // API Keys
  async listAPIKeys(organizationId?: string) {
    const response = await this.client.get('/api/v1/apikeys', {
      params: organizationId ? { organization_id: organizationId } : {},
    });

    const rawKeys = response.data?.keys || [];

    // Normalize keys to frontend shape (support PascalCase from Go structs
    // or snake_case from explicit JSON mapping)
    const keys = rawKeys.map((k: any) => ({
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
    }));

    return keys;
  }

  async createAPIKey(data: {
    name: string;
    organization_id: string;
    description?: string;
    scopes: string[];
    expires_at?: string;
  }) {
    const response = await this.client.post('/api/v1/apikeys', data);
    return response.data;
  }

  async getAPIKey(id: string) {
    const response = await this.client.get(`/api/v1/apikeys/${id}`);
    return response.data;
  }

  async updateAPIKey(
    id: string,
    data: { name?: string; scopes?: string[]; expires_at?: string }
  ) {
    const response = await this.client.put(`/api/v1/apikeys/${id}`, data);
    return response.data;
  }

  async deleteAPIKey(id: string) {
    const response = await this.client.delete(`/api/v1/apikeys/${id}`);
    return response.data;
  }

  async rotateAPIKey(id: string, gracePeriodHours: number = 0) {
    const response = await this.client.post(`/api/v1/apikeys/${id}/rotate`, {
      grace_period_hours: gracePeriodHours,
    });
    return response.data;
  }

  // SCM Provider Management
  async listSCMProviders(organizationId?: string) {
    const params = organizationId ? { organization_id: organizationId } : {};
    const response = await this.client.get('/api/v1/scm-providers', { params });
    return response.data;
  }

  async createSCMProvider(data: {
    organization_id: string;
    provider_type: string;
    name: string;
    base_url?: string | null;
    client_id?: string;
    client_secret?: string;
    webhook_secret?: string;
  }) {
    const response = await this.client.post('/api/v1/scm-providers', data);
    return response.data;
  }

  async getSCMProvider(id: string) {
    const response = await this.client.get(`/api/v1/scm-providers/${id}`);
    return response.data;
  }

  async updateSCMProvider(
    id: string,
    data: {
      name?: string;
      base_url?: string | null;
      tenant_id?: string | null;
      client_id?: string;
      client_secret?: string;
      webhook_secret?: string;
      is_active?: boolean;
    }
  ) {
    const response = await this.client.put(`/api/v1/scm-providers/${id}`, data);
    return response.data;
  }

  async deleteSCMProvider(id: string) {
    const response = await this.client.delete(`/api/v1/scm-providers/${id}`);
    return response.data;
  }

  // SCM OAuth
  async initiateSCMOAuth(providerId: string) {
    const response = await this.client.get(`/api/v1/scm-providers/${providerId}/oauth/authorize`);
    return response.data;
  }

  async refreshSCMToken(providerId: string) {
    const response = await this.client.post(`/api/v1/scm-providers/${providerId}/oauth/refresh`);
    return response.data;
  }

  async getSCMTokenStatus(providerId: string): Promise<{
    connected: boolean;
    connected_at?: string;
    expires_at?: string | null;
    token_type?: string;
  }> {
    const response = await this.client.get(`/api/v1/scm-providers/${providerId}/oauth/token`);
    return response.data;
  }

  async listSCMRepositories(providerId: string, search?: string) {
    const params = search ? { search } : {};
    const response = await this.client.get(`/api/v1/scm-providers/${providerId}/repositories`, { params });
    return response.data;
  }

  async listSCMRepositoryTags(providerId: string, owner: string, repo: string) {
    const response = await this.client.get(`/api/v1/scm-providers/${providerId}/repositories/${owner}/${repo}/tags`);
    return response.data;
  }

  async listSCMRepositoryBranches(providerId: string, owner: string, repo: string) {
    const response = await this.client.get(`/api/v1/scm-providers/${providerId}/repositories/${owner}/${repo}/branches`);
    return response.data;
  }

  async revokeSCMToken(providerId: string) {
    const response = await this.client.delete(`/api/v1/scm-providers/${providerId}/oauth/token`);
    return response.data;
  }

  async saveSCMToken(providerId: string, accessToken: string) {
    const response = await this.client.post(`/api/v1/scm-providers/${providerId}/token`, {
      access_token: accessToken,
    });
    return response.data;
  }

  // Module SCM Linking
  async linkModuleToSCM(
    moduleId: string,
    data: {
      provider_id: string;
      repository_owner: string;
      repository_name: string;
      repository_path?: string;
      default_branch?: string;
      auto_publish_enabled?: boolean;
      tag_pattern?: string;
    }
  ) {
    const response = await this.client.post(`/api/v1/admin/modules/${moduleId}/scm`, data);
    return response.data;
  }

  async getModuleSCMInfo(moduleId: string) {
    const response = await this.client.get(`/api/v1/admin/modules/${moduleId}/scm`);
    return response.data;
  }

  async updateModuleSCMLink(
    moduleId: string,
    data: {
      repository_path?: string;
      default_branch?: string;
      auto_publish_enabled?: boolean;
      tag_pattern?: string;
    }
  ) {
    const response = await this.client.put(`/api/v1/admin/modules/${moduleId}/scm`, data);
    return response.data;
  }

  async unlinkModuleFromSCM(moduleId: string) {
    const response = await this.client.delete(`/api/v1/admin/modules/${moduleId}/scm`);
    return response.data;
  }

  async triggerManualSync(moduleId: string, data?: { tag_name?: string; commit_sha?: string }) {
    const response = await this.client.post(`/api/v1/admin/modules/${moduleId}/scm/sync`, data || {});
    return response.data;
  }

  async getWebhookEvents(moduleId: string) {
    const response = await this.client.get(`/api/v1/admin/modules/${moduleId}/scm/events`);
    return response.data;
  }

  // Dashboard Stats
  async getDashboardStats() {
    const response = await this.client.get('/api/v1/admin/stats/dashboard');
    return response.data;
  }

  // Mirror Management
  async listMirrors(enabledOnly = false) {
    const params = enabledOnly ? { enabled: 'true' } : {};
    const response = await this.client.get('/api/v1/admin/mirrors', { params });
    return response.data.mirrors || [];
  }

  async getMirror(id: string) {
    const response = await this.client.get(`/api/v1/admin/mirrors/${id}`);
    return response.data;
  }

  async createMirror(data: {
    name: string;
    description?: string;
    upstream_registry_url: string;
    organization_id?: string;
    namespace_filter?: string[];
    provider_filter?: string[];
    enabled?: boolean;
    sync_interval_hours?: number;
  }) {
    const response = await this.client.post('/api/v1/admin/mirrors', data);
    return response.data;
  }

  async updateMirror(
    id: string,
    data: {
      name?: string;
      description?: string;
      upstream_registry_url?: string;
      organization_id?: string;
      namespace_filter?: string[];
      provider_filter?: string[];
      enabled?: boolean;
      sync_interval_hours?: number;
    }
  ) {
    const response = await this.client.put(`/api/v1/admin/mirrors/${id}`, data);
    return response.data;
  }

  async deleteMirror(id: string) {
    const response = await this.client.delete(`/api/v1/admin/mirrors/${id}`);
    return response.data;
  }

  async triggerMirrorSync(id: string, data?: { namespace?: string; provider_name?: string }) {
    const response = await this.client.post(`/api/v1/admin/mirrors/${id}/sync`, data || {});
    return response.data;
  }

  async getMirrorStatus(id: string) {
    const response = await this.client.get(`/api/v1/admin/mirrors/${id}/status`);
    return response.data;
  }

  // ============================================================================
  // Role Templates
  // ============================================================================

  async listRoleTemplates() {
    const response = await this.client.get('/api/v1/admin/role-templates');
    return response.data || [];
  }

  async getRoleTemplate(id: string) {
    const response = await this.client.get(`/api/v1/admin/role-templates/${id}`);
    return response.data;
  }

  async createRoleTemplate(data: {
    name: string;
    display_name: string;
    description?: string;
    scopes: string[];
  }) {
    const response = await this.client.post('/api/v1/admin/role-templates', data);
    return response.data;
  }

  async updateRoleTemplate(
    id: string,
    data: {
      name?: string;
      display_name?: string;
      description?: string;
      scopes?: string[];
    }
  ) {
    const response = await this.client.put(`/api/v1/admin/role-templates/${id}`, data);
    return response.data;
  }

  async deleteRoleTemplate(id: string) {
    const response = await this.client.delete(`/api/v1/admin/role-templates/${id}`);
    return response.data;
  }

  // ============================================================================
  // Mirror Approval Requests
  // ============================================================================

  async listApprovalRequests(options?: { organization_id?: string; status?: string }) {
    const params: Record<string, string> = {};
    if (options?.organization_id) params.organization_id = options.organization_id;
    if (options?.status) params.status = options.status;
    const response = await this.client.get('/api/v1/admin/approvals', { params });
    return response.data || [];
  }

  async getApprovalRequest(id: string) {
    const response = await this.client.get(`/api/v1/admin/approvals/${id}`);
    return response.data;
  }

  async createApprovalRequest(data: {
    mirror_config_id: string;
    provider_namespace: string;
    provider_name?: string;
    reason?: string;
  }) {
    const response = await this.client.post('/api/v1/admin/approvals', data);
    return response.data;
  }

  async reviewApproval(id: string, data: { status: 'approved' | 'rejected'; notes?: string }) {
    const response = await this.client.put(`/api/v1/admin/approvals/${id}/review`, data);
    return response.data;
  }

  // ============================================================================
  // Mirror Policies
  // ============================================================================

  async listMirrorPolicies(organizationId?: string) {
    const params = organizationId ? { organization_id: organizationId } : {};
    const response = await this.client.get('/api/v1/admin/policies', { params });
    return response.data || [];
  }

  async getMirrorPolicy(id: string) {
    const response = await this.client.get(`/api/v1/admin/policies/${id}`);
    return response.data;
  }

  async createMirrorPolicy(data: {
    organization_id?: string;
    name: string;
    description?: string;
    policy_type: 'allow' | 'deny';
    upstream_registry?: string;
    namespace_pattern?: string;
    provider_pattern?: string;
    priority?: number;
    is_active?: boolean;
    requires_approval?: boolean;
  }) {
    const response = await this.client.post('/api/v1/admin/policies', data);
    return response.data;
  }

  async updateMirrorPolicy(
    id: string,
    data: {
      name?: string;
      description?: string;
      policy_type?: 'allow' | 'deny';
      upstream_registry?: string;
      namespace_pattern?: string;
      provider_pattern?: string;
      priority?: number;
      is_active?: boolean;
      requires_approval?: boolean;
    }
  ) {
    const response = await this.client.put(`/api/v1/admin/policies/${id}`, data);
    return response.data;
  }

  async deleteMirrorPolicy(id: string) {
    const response = await this.client.delete(`/api/v1/admin/policies/${id}`);
    return response.data;
  }

  async evaluateMirrorPolicy(data: {
    registry: string;
    namespace: string;
    provider: string;
  }, organizationId?: string) {
    const params = organizationId ? { organization_id: organizationId } : {};
    const response = await this.client.post('/api/v1/admin/policies/evaluate', data, { params });
    return response.data;
  }

  // ============================================================================
  // Development-Only Endpoints (disabled in production)
  // ============================================================================

  async getDevStatus(): Promise<{ dev_mode: boolean; message?: string }> {
    const response = await this.client.get('/api/v1/dev/status');
    return response.data;
  }

  async devLogin(): Promise<{ token: string; user: any; expires_in: number }> {
    const response = await this.client.post('/api/v1/dev/login');
    return response.data;
  }

  async listUsersForImpersonation(): Promise<{
    users: Array<{
      id: string;
      email: string;
      name: string;
      primary_role: string;
    }>;
    dev_mode: boolean;
  }> {
    const response = await this.client.get('/api/v1/dev/users');
    return response.data;
  }

  async impersonateUser(userId: string): Promise<{
    token: string;
    user: {
      id: string;
      email: string;
      name: string;
    };
    message: string;
  }> {
    const response = await this.client.post(`/api/v1/dev/impersonate/${userId}`);
    return response.data;
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
    };
  }

  async validateSetupToken(
    setupToken: string
  ): Promise<import('../types').SetupValidateTokenResponse> {
    const response = await this.client.post(
      '/api/v1/setup/validate-token',
      {},
      this.setupRequest(setupToken)
    );
    return response.data;
  }

  async testOIDCConfig(
    setupToken: string,
    data: import('../types').OIDCConfigInput
  ): Promise<import('../types').SetupTestResult> {
    const response = await this.client.post(
      '/api/v1/setup/oidc/test',
      data,
      this.setupRequest(setupToken)
    );
    return response.data;
  }

  async saveOIDCConfig(
    setupToken: string,
    data: import('../types').OIDCConfigInput
  ): Promise<import('../types').OIDCConfigResponse> {
    const response = await this.client.post(
      '/api/v1/setup/oidc',
      data,
      this.setupRequest(setupToken)
    );
    return response.data;
  }

  async testSetupStorageConfig(
    setupToken: string,
    data: import('../types').StorageConfigInput
  ): Promise<import('../types').SetupTestResult> {
    const response = await this.client.post(
      '/api/v1/setup/storage/test',
      data,
      this.setupRequest(setupToken)
    );
    return response.data;
  }

  async saveSetupStorageConfig(
    setupToken: string,
    data: import('../types').StorageConfigInput
  ): Promise<{ message: string; config: import('../types').StorageConfigResponse }> {
    const response = await this.client.post(
      '/api/v1/setup/storage',
      data,
      this.setupRequest(setupToken)
    );
    return response.data;
  }

  async configureAdmin(
    setupToken: string,
    data: import('../types').ConfigureAdminInput
  ): Promise<import('../types').ConfigureAdminResponse> {
    const response = await this.client.post(
      '/api/v1/setup/admin',
      data,
      this.setupRequest(setupToken)
    );
    return response.data;
  }

  async completeSetup(
    setupToken: string
  ): Promise<import('../types').CompleteSetupResponse> {
    const response = await this.client.post(
      '/api/v1/setup/complete',
      {},
      this.setupRequest(setupToken)
    );
    return response.data;
  }

  // ============================================================================
  // Storage Configuration
  // ============================================================================

  async getSetupStatus(): Promise<import('../types').SetupStatus> {
    const response = await this.client.get('/api/v1/setup/status');
    return response.data;
  }

  async getActiveStorageConfig(): Promise<import('../types').StorageConfigResponse> {
    const response = await this.client.get('/api/v1/storage/config');
    return response.data;
  }

  async listStorageConfigs(): Promise<import('../types').StorageConfigResponse[]> {
    const response = await this.client.get('/api/v1/storage/configs');
    return response.data;
  }

  async getStorageConfig(id: string): Promise<import('../types').StorageConfigResponse> {
    const response = await this.client.get(`/api/v1/storage/configs/${id}`);
    return response.data;
  }

  async createStorageConfig(data: import('../types').StorageConfigInput): Promise<import('../types').StorageConfigResponse> {
    const response = await this.client.post('/api/v1/storage/configs', data);
    return response.data;
  }

  async updateStorageConfig(
    id: string,
    data: import('../types').StorageConfigInput
  ): Promise<import('../types').StorageConfigResponse> {
    const response = await this.client.put(`/api/v1/storage/configs/${id}`, data);
    return response.data;
  }

  async deleteStorageConfig(id: string): Promise<void> {
    await this.client.delete(`/api/v1/storage/configs/${id}`);
  }

  async activateStorageConfig(id: string): Promise<{ message: string; config: import('../types').StorageConfigResponse }> {
    const response = await this.client.post(`/api/v1/storage/configs/${id}/activate`);
    return response.data;
  }

  async testStorageConfig(data: import('../types').StorageConfigInput): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/api/v1/storage/configs/test', data);
    return response.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;

