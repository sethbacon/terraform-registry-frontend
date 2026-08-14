/**
 * Composed API client barrel.
 *
 * The old 1900-line ApiClient god object (issue #474) is split into per-domain
 * modules that all share the single configured axios instance in ./http.ts
 * (interceptors: CSRF double-submit echo, 401 session handling,
 * error-reporting breadcrumbs).
 *
 * This barrel spreads every domain module into one flat `apiClient` object so
 * the existing `import apiClient from '../services/api'` call sites keep
 * working unchanged. New code can import a domain module directly instead,
 * e.g. `import { searchModules } from '../services/api/modulesApi'`.
 *
 * Method names are unique across domains — a collision would silently drop a
 * method in the spread below, so the api.test.ts parity test asserts the
 * composed surface matches the sum of the domain modules.
 */
import * as adminStatsApi from './adminStatsApi'
import * as advisoriesApi from './advisoriesApi'
import * as apiKeysApi from './apiKeysApi'
import * as auditApi from './auditApi'
import * as authApi from './authApi'
import * as identityApi from './identityApi'
import * as mirrorsApi from './mirrorsApi'
import * as modulesApi from './modulesApi'
import * as notificationsApi from './notificationsApi'
import * as organizationsApi from './organizationsApi'
import * as platformAdminsApi from './platformAdminsApi'
import * as providersApi from './providersApi'
import * as rolesApi from './rolesApi'
import * as scanningApi from './scanningApi'
import * as scmApi from './scmApi'
import * as setupApi from './setupApi'
import * as storageApi from './storageApi'
import * as suiteApi from './suiteApi'
import * as terraformMirrorApi from './terraformMirrorApi'
import * as themeApi from './themeApi'
import * as usersApi from './usersApi'
import * as versionApi from './versionApi'
import * as versionApprovalsApi from './versionApprovalsApi'

// devApi (dev/status, dev/login, dev/users, dev/impersonate/:id) is deliberately
// NOT part of this barrel. Every other domain module here is spread into the
// eagerly-imported `apiClient` object below, which pulls its code into the main
// bundle regardless of any import.meta.env.DEV guard at the *call site* --
// spreading devApi in too would defeat DevUserSwitcher's lazy import and undo
// the dead-code elimination it exists for (#608). Import
// '../services/api/devApi' directly (statically only from code that is itself
// dev-only/lazy-loaded, or via a dynamic import()) instead.

/** Domain modules composed into the flat client, exported for the parity test. */
export const apiDomains = {
  adminStatsApi,
  advisoriesApi,
  apiKeysApi,
  auditApi,
  authApi,
  identityApi,
  mirrorsApi,
  modulesApi,
  notificationsApi,
  organizationsApi,
  platformAdminsApi,
  providersApi,
  rolesApi,
  scanningApi,
  scmApi,
  setupApi,
  storageApi,
  suiteApi,
  terraformMirrorApi,
  themeApi,
  usersApi,
  versionApi,
  versionApprovalsApi,
}

const apiClient = {
  ...adminStatsApi,
  ...advisoriesApi,
  ...apiKeysApi,
  ...auditApi,
  ...authApi,
  ...identityApi,
  ...mirrorsApi,
  ...modulesApi,
  ...notificationsApi,
  ...organizationsApi,
  ...platformAdminsApi,
  ...providersApi,
  ...rolesApi,
  ...scanningApi,
  ...scmApi,
  ...setupApi,
  ...storageApi,
  ...suiteApi,
  ...terraformMirrorApi,
  ...themeApi,
  ...usersApi,
  ...versionApi,
  ...versionApprovalsApi,
}

export type { ModuleConsumer } from './modulesApi'
export type { SuiteSibling } from './suiteApi'

export default apiClient
