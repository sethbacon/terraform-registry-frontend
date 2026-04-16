import { describe, it, expect } from 'vitest'
import { queryKeys } from '../queryKeys'

describe('queryKeys', () => {
  describe('modules', () => {
    it('has a stable _def key', () => {
      expect(queryKeys.modules._def).toEqual(['modules'])
    })

    it('search key includes params', () => {
      const key = queryKeys.modules.search({ query: 'vpc', limit: 10, offset: 0, viewMode: 'grid' })
      expect(key[0]).toBe('modules')
      expect(key[1]).toBe('search')
      expect(key[2]).toEqual({ query: 'vpc', limit: 10, offset: 0, viewMode: 'grid' })
    })

    it('search key with sort and order', () => {
      const key = queryKeys.modules.search({ query: 'test', limit: 20, offset: 10, viewMode: 'list', sort: 'name', order: 'asc' })
      expect(key[2]).toMatchObject({ sort: 'name', order: 'asc' })
    })

    it('detail key includes namespace/name/system', () => {
      const key = queryKeys.modules.detail('hashicorp', 'consul', 'aws')
      expect(key).toEqual(['modules', 'detail', 'hashicorp', 'consul', 'aws'])
    })

    it('versions key includes namespace/name/system', () => {
      const key = queryKeys.modules.versions('hashicorp', 'consul', 'aws')
      expect(key).toEqual(['modules', 'versions', 'hashicorp', 'consul', 'aws'])
    })

    it('scm key includes moduleId', () => {
      const key = queryKeys.modules.scm('mod-123')
      expect(key).toEqual(['modules', 'scm', 'mod-123'])
    })

    it('scan key includes namespace/name/system/version', () => {
      const key = queryKeys.modules.scan('hashicorp', 'consul', 'aws', '1.0.0')
      expect(key).toEqual(['modules', 'scan', 'hashicorp', 'consul', 'aws', '1.0.0'])
    })

    it('docs key includes namespace/name/system/version', () => {
      const key = queryKeys.modules.docs('hashicorp', 'consul', 'aws', '1.0.0')
      expect(key).toEqual(['modules', 'docs', 'hashicorp', 'consul', 'aws', '1.0.0'])
    })

    it('webhookEvents key includes moduleId', () => {
      const key = queryKeys.modules.webhookEvents('mod-456')
      expect(key).toEqual(['modules', 'webhookEvents', 'mod-456'])
    })
  })

  describe('providers', () => {
    it('has a stable _def key', () => {
      expect(queryKeys.providers._def).toEqual(['providers'])
    })

    it('search key includes params', () => {
      const key = queryKeys.providers.search({ query: 'aws', limit: 10, offset: 0, sort: 'name', order: 'asc' })
      expect(key[0]).toBe('providers')
      expect(key[1]).toBe('search')
      expect(key[2]).toMatchObject({ query: 'aws', sort: 'name', order: 'asc' })
    })

    it('detail key includes namespace/type', () => {
      const key = queryKeys.providers.detail('hashicorp', 'aws')
      expect(key).toEqual(['providers', 'detail', 'hashicorp', 'aws'])
    })

    it('versions key includes namespace/type', () => {
      const key = queryKeys.providers.versions('hashicorp', 'aws')
      expect(key).toEqual(['providers', 'versions', 'hashicorp', 'aws'])
    })
  })

  describe('dashboard', () => {
    it('stats key is stable', () => {
      expect(queryKeys.dashboard.stats()).toEqual(['dashboard', 'stats'])
    })
  })

  describe('users', () => {
    it('has a stable _def key', () => {
      expect(queryKeys.users._def).toEqual(['users'])
    })

    it('list key includes params', () => {
      const key = queryKeys.users.list({ page: 1, perPage: 20, search: 'john' })
      expect(key).toEqual(['users', 'list', { page: 1, perPage: 20, search: 'john' }])
    })

    it('list key works without params', () => {
      const key = queryKeys.users.list()
      expect(key).toEqual(['users', 'list', undefined])
    })

    it('detail key includes id', () => {
      expect(queryKeys.users.detail('u-123')).toEqual(['users', 'detail', 'u-123'])
    })

    it('memberships key includes userId', () => {
      expect(queryKeys.users.memberships('u-123')).toEqual(['users', 'memberships', 'u-123'])
    })
  })

  describe('organizations', () => {
    it('has a stable _def key', () => {
      expect(queryKeys.organizations._def).toEqual(['organizations'])
    })

    it('list key includes params', () => {
      const key = queryKeys.organizations.list({ page: 2, perPage: 10 })
      expect(key).toEqual(['organizations', 'list', { page: 2, perPage: 10 }])
    })

    it('detail key includes id', () => {
      expect(queryKeys.organizations.detail('org-1')).toEqual(['organizations', 'detail', 'org-1'])
    })

    it('members key includes orgId', () => {
      expect(queryKeys.organizations.members('org-1')).toEqual(['organizations', 'members', 'org-1'])
    })
  })

  describe('apiKeys', () => {
    it('has a stable _def key', () => {
      expect(queryKeys.apiKeys._def).toEqual(['apiKeys'])
    })

    it('list key includes organizationId', () => {
      expect(queryKeys.apiKeys.list('org-1')).toEqual(['apiKeys', 'list', 'org-1'])
    })

    it('list key works without organizationId', () => {
      expect(queryKeys.apiKeys.list()).toEqual(['apiKeys', 'list', undefined])
    })

    it('memberships key includes userId', () => {
      expect(queryKeys.apiKeys.memberships('u-1')).toEqual(['apiKeys', 'memberships', 'u-1'])
    })
  })

  describe('scmProviders', () => {
    it('has a stable _def key', () => {
      expect(queryKeys.scmProviders._def).toEqual(['scmProviders'])
    })

    it('list key includes organizationId', () => {
      expect(queryKeys.scmProviders.list('org-1')).toEqual(['scmProviders', 'list', 'org-1'])
    })

    it('tokenStatus key includes providerId', () => {
      expect(queryKeys.scmProviders.tokenStatus('scm-1')).toEqual(['scmProviders', 'tokenStatus', 'scm-1'])
    })

    it('memberships key includes userId', () => {
      expect(queryKeys.scmProviders.memberships('u-1')).toEqual(['scmProviders', 'memberships', 'u-1'])
    })
  })

  describe('auditLogs', () => {
    it('has a stable _def key', () => {
      expect(queryKeys.auditLogs._def).toEqual(['auditLogs'])
    })

    it('list key includes params', () => {
      const params = { action: 'create', resource: 'module' }
      expect(queryKeys.auditLogs.list(params)).toEqual(['auditLogs', 'list', params])
    })
  })

  describe('storageConfigs', () => {
    it('list key is stable', () => {
      expect(queryKeys.storageConfigs.list()).toEqual(['storageConfigs', 'list'])
    })

    it('setupStatus key is stable', () => {
      expect(queryKeys.storageConfigs.setupStatus()).toEqual(['storageConfigs', 'setupStatus'])
    })
  })

  describe('storageMigrations', () => {
    it('list key is stable', () => {
      expect(queryKeys.storageMigrations.list()).toEqual(['storageMigrations', 'list'])
    })

    it('detail key includes id', () => {
      expect(queryKeys.storageMigrations.detail('mig-1')).toEqual(['storageMigrations', 'detail', 'mig-1'])
    })
  })

  describe('mirrors', () => {
    it('list key is stable', () => {
      expect(queryKeys.mirrors.list()).toEqual(['mirrors', 'list'])
    })

    it('providers key includes mirrorId', () => {
      expect(queryKeys.mirrors.providers('m-1')).toEqual(['mirrors', 'providers', 'm-1'])
    })
  })

  describe('roles', () => {
    it('list key is stable', () => {
      expect(queryKeys.roles.list()).toEqual(['roles', 'list'])
    })
  })

  describe('approvals', () => {
    it('list key includes status param', () => {
      expect(queryKeys.approvals.list({ status: 'pending' })).toEqual(['approvals', 'list', { status: 'pending' }])
    })

    it('list key works without params', () => {
      expect(queryKeys.approvals.list()).toEqual(['approvals', 'list', undefined])
    })
  })

  describe('policies', () => {
    it('list key includes organizationId', () => {
      expect(queryKeys.policies.list('org-1')).toEqual(['policies', 'list', 'org-1'])
    })
  })

  describe('oidcConfig', () => {
    it('get key is stable', () => {
      expect(queryKeys.oidcConfig.get()).toEqual(['oidcConfig', 'get'])
    })
  })

  describe('terraformMirrors', () => {
    it('list key is stable', () => {
      expect(queryKeys.terraformMirrors.list()).toEqual(['terraformMirrors', 'list'])
    })

    it('status key includes configId', () => {
      expect(queryKeys.terraformMirrors.status('cfg-1')).toEqual(['terraformMirrors', 'status', 'cfg-1'])
    })

    it('versions key includes configId', () => {
      expect(queryKeys.terraformMirrors.versions('cfg-1')).toEqual(['terraformMirrors', 'versions', 'cfg-1'])
    })

    it('history key includes configId', () => {
      expect(queryKeys.terraformMirrors.history('cfg-1')).toEqual(['terraformMirrors', 'history', 'cfg-1'])
    })
  })

  describe('key uniqueness across all domains', () => {
    it('all top-level _def keys are unique', () => {
      const allDefs = [
        queryKeys.modules._def,
        queryKeys.providers._def,
        queryKeys.dashboard._def,
        queryKeys.users._def,
        queryKeys.organizations._def,
        queryKeys.apiKeys._def,
        queryKeys.scmProviders._def,
        queryKeys.auditLogs._def,
        queryKeys.storageConfigs._def,
        queryKeys.storageMigrations._def,
        queryKeys.mirrors._def,
        queryKeys.roles._def,
        queryKeys.approvals._def,
        queryKeys.policies._def,
        queryKeys.oidcConfig._def,
        queryKeys.terraformMirrors._def,
      ]
      const prefixes = allDefs.map(d => d[0])
      expect(new Set(prefixes).size).toBe(prefixes.length)
    })
  })
})
