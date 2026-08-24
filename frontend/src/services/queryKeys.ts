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
    consumers: (namespace: string, name: string, system: string) =>
      [...queryKeys.modules._def, 'consumers', namespace, name, system] as const,
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
    docs: (namespace: string, type: string, version: string) =>
      [...queryKeys.providers._def, 'docs', namespace, type, version] as const,
  },
  dashboard: {
    _def: ['dashboard'] as const,
    // ORGANIZATION-PARAMETERISED (#798). The payload is already tenant-derived:
    // the backend scopes every panel by the caller's resolved organization
    // scope rather than by a requested id, so today every caller passes
    // undefined and the key is unchanged. It takes the argument anyway because
    // the day a picker narrows the dashboard, a key that cannot express the
    // narrowing serves the previous organization's counts from cache.
    stats: (organizationId?: string) =>
      [...queryKeys.dashboard._def, 'stats', organizationId] as const,
  },
  users: {
    _def: ['users'] as const,
    // ORGANIZATION-PARAMETERISED (#798). Users are listed with their
    // memberships and are filtered server-side by the caller's organization
    // scope, so a narrowed list is a different list. The organization is a
    // separate argument rather than a `params` member so the key varies by
    // organization whether or not a caller remembered to put it in `params`.
    list: (
      params?: { page?: number; perPage?: number; search?: string },
      organizationId?: string,
    ) => [...queryKeys.users._def, 'list', params, organizationId] as const,
    detail: (id: string) => [...queryKeys.users._def, 'detail', id] as const,
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
  },
  scmProviders: {
    _def: ['scmProviders'] as const,
    list: (organizationId?: string) =>
      [...queryKeys.scmProviders._def, 'list', organizationId] as const,
    tokenStatus: (providerId: string) =>
      [...queryKeys.scmProviders._def, 'tokenStatus', providerId] as const,
  },
  auditLogs: {
    _def: ['auditLogs'] as const,
    // ORGANIZATION-PARAMETERISED (#798). The backend has accepted
    // `?organization_id=` since backend #719 and validates it against the
    // caller's scope, so two organizations are genuinely two result sets.
    // `organizationId` is passed separately from `params` (which also carries
    // it on the wire) so the key is org-varying by construction, not by a
    // caller's discipline.
    list: (params?: Record<string, unknown>, organizationId?: string) =>
      [...queryKeys.auditLogs._def, 'list', params, organizationId] as const,
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
    // ORGANIZATION-PARAMETERISED (#798). Mirror configs carry an
    // `organization_id` and `listMirrors` already accepts one as a request
    // parameter — the key was the only part of the path that could not
    // express it.
    list: (organizationId?: string) => [...queryKeys.mirrors._def, 'list', organizationId] as const,
    // Deliberately global: a mirror's provider inventory is addressed by
    // mirror id, which is itself already organization-scoped.
    providers: (mirrorId: string) => [...queryKeys.mirrors._def, 'providers', mirrorId] as const,
  },
  roles: {
    _def: ['roles'] as const,
    list: () => [...queryKeys.roles._def, 'list'] as const,
  },
  platformAdmins: {
    _def: ['platformAdmins'] as const,
    list: () => [...queryKeys.platformAdmins._def, 'list'] as const,
  },
  approvals: {
    _def: ['approvals'] as const,
    // ORGANIZATION-PARAMETERISED (#798). Approval queues are per-organization
    // work lists; showing one organization's pending items under another's
    // heading is the failure mode this widening exists to prevent.
    list: (params?: { status?: string }, organizationId?: string) =>
      [...queryKeys.approvals._def, 'list', params, organizationId] as const,
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
    releasesGPGKeys: () => [...queryKeys.terraformMirrors._def, 'releasesGPGKeys'] as const,
  },
  advisories: {
    _def: ['advisories'] as const,
    active: () => [...queryKeys.advisories._def, 'active'] as const,
    adminList: (kind?: string) => [...queryKeys.advisories._def, 'admin', kind] as const,
  },
  versionApprovals: {
    _def: ['versionApprovals'] as const,
    // ORGANIZATION-PARAMETERISED (#798), for the same reason as `approvals`:
    // the rows are the organization's pending version promotions.
    list: (
      params?: { type?: string; config_id?: string; status?: string },
      organizationId?: string,
    ) => [...queryKeys.versionApprovals._def, 'list', params, organizationId] as const,
    // ORGANIZATION-PARAMETERISED (#798). This count is rendered as a nav badge
    // beside the list above; a badge that keeps the previous organization's
    // number is the same defect, one pixel smaller.
    pendingCount: (organizationId?: string) =>
      [...queryKeys.versionApprovals._def, 'pendingCount', organizationId] as const,
    events: (id: string) => [...queryKeys.versionApprovals._def, 'events', id] as const,
  },
  scanner: {
    _def: ['scanner'] as const,
    latest: (tool: string) => [...queryKeys.scanner._def, 'latest', tool] as const,
  },
  notifications: {
    _def: ['notifications'] as const,
    config: () => [...queryKeys.notifications._def, 'config'] as const,
    channels: () => [...queryKeys.notifications._def, 'channels'] as const,
  },
  ui: {
    theme: () => ['ui', 'theme'] as const,
  },
} as const
