export const queryKeys = {
  modules: {
    _def: ['modules'] as const,
    search: (params: {
      query?: string
      limit: number
      offset: number
      viewMode: string
      sort?: string
      order?: string
    }) => [...queryKeys.modules._def, 'search', params] as const,
    detail: (namespace: string, name: string, system: string) =>
      [...queryKeys.modules._def, 'detail', namespace, name, system] as const,
    versions: (namespace: string, name: string, system: string) =>
      [...queryKeys.modules._def, 'versions', namespace, name, system] as const,
    scm: (moduleId: string) => [...queryKeys.modules._def, 'scm', moduleId] as const,
    scan: (namespace: string, name: string, system: string, version: string) =>
      [...queryKeys.modules._def, 'scan', namespace, name, system, version] as const,
    docs: (namespace: string, name: string, system: string, version: string) =>
      [...queryKeys.modules._def, 'docs', namespace, name, system, version] as const,
    webhookEvents: (moduleId: string) =>
      [...queryKeys.modules._def, 'webhookEvents', moduleId] as const,
  },
  providers: {
    _def: ['providers'] as const,
    search: (params: {
      query?: string
      limit: number
      offset: number
      sort?: string
      order?: string
    }) => [...queryKeys.providers._def, 'search', params] as const,
    detail: (namespace: string, type: string) =>
      [...queryKeys.providers._def, 'detail', namespace, type] as const,
    versions: (namespace: string, type: string) =>
      [...queryKeys.providers._def, 'versions', namespace, type] as const,
  },
  dashboard: {
    _def: ['dashboard'] as const,
    stats: () => [...queryKeys.dashboard._def, 'stats'] as const,
  },
  users: {
    _def: ['users'] as const,
    list: (params?: { page?: number; perPage?: number; search?: string }) =>
      [...queryKeys.users._def, 'list', params] as const,
    detail: (id: string) => [...queryKeys.users._def, 'detail', id] as const,
    memberships: (userId: string) => [...queryKeys.users._def, 'memberships', userId] as const,
  },
  organizations: {
    _def: ['organizations'] as const,
    list: (params?: { page?: number; perPage?: number; search?: string }) =>
      [...queryKeys.organizations._def, 'list', params] as const,
    detail: (id: string) => [...queryKeys.organizations._def, 'detail', id] as const,
    members: (orgId: string) => [...queryKeys.organizations._def, 'members', orgId] as const,
  },
  apiKeys: {
    _def: ['apiKeys'] as const,
    list: (organizationId?: string) => [...queryKeys.apiKeys._def, 'list', organizationId] as const,
    memberships: (userId: string) => [...queryKeys.apiKeys._def, 'memberships', userId] as const,
  },
  scmProviders: {
    _def: ['scmProviders'] as const,
    list: (organizationId?: string) =>
      [...queryKeys.scmProviders._def, 'list', organizationId] as const,
    tokenStatus: (providerId: string) =>
      [...queryKeys.scmProviders._def, 'tokenStatus', providerId] as const,
    memberships: (userId: string) =>
      [...queryKeys.scmProviders._def, 'memberships', userId] as const,
  },
  auditLogs: {
    _def: ['auditLogs'] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.auditLogs._def, 'list', params] as const,
  },
  storageConfigs: {
    _def: ['storageConfigs'] as const,
    list: () => [...queryKeys.storageConfigs._def, 'list'] as const,
    setupStatus: () => [...queryKeys.storageConfigs._def, 'setupStatus'] as const,
  },
  storageMigrations: {
    _def: ['storageMigrations'] as const,
    list: () => [...queryKeys.storageMigrations._def, 'list'] as const,
    detail: (id: string) => [...queryKeys.storageMigrations._def, 'detail', id] as const,
  },
  mirrors: {
    _def: ['mirrors'] as const,
    list: () => [...queryKeys.mirrors._def, 'list'] as const,
    providers: (mirrorId: string) => [...queryKeys.mirrors._def, 'providers', mirrorId] as const,
  },
  roles: {
    _def: ['roles'] as const,
    list: () => [...queryKeys.roles._def, 'list'] as const,
  },
  approvals: {
    _def: ['approvals'] as const,
    list: (params?: { status?: string }) => [...queryKeys.approvals._def, 'list', params] as const,
  },
  policies: {
    _def: ['policies'] as const,
    list: (organizationId?: string) =>
      [...queryKeys.policies._def, 'list', organizationId] as const,
  },
  quotas: {
    _def: ['quotas'] as const,
    list: (orgId?: string) => [...queryKeys.quotas._def, 'list', orgId] as const,
  },
  oidcConfig: {
    _def: ['oidcConfig'] as const,
    get: () => [...queryKeys.oidcConfig._def, 'get'] as const,
  },
  versionInfo: {
    _def: ['versionInfo'] as const,
    get: () => [...queryKeys.versionInfo._def, 'get'] as const,
  },
  terraformMirrors: {
    _def: ['terraformMirrors'] as const,
    list: () => [...queryKeys.terraformMirrors._def, 'list'] as const,
    status: (configId: string) => [...queryKeys.terraformMirrors._def, 'status', configId] as const,
    versions: (configId: string) =>
      [...queryKeys.terraformMirrors._def, 'versions', configId] as const,
    history: (configId: string) =>
      [...queryKeys.terraformMirrors._def, 'history', configId] as const,
  },
  advisories: {
    _def: ['advisories'] as const,
    active: () => [...queryKeys.advisories._def, 'active'] as const,
    adminList: (kind?: string) => [...queryKeys.advisories._def, 'admin', kind] as const,
  },
} as const
