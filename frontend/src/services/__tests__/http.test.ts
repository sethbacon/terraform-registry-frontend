import { describe, it, expect } from 'vitest'
import { isSCMOAuthFailureUrl, checkCsrfOriginConfig, classifySession401 } from '../api/http'

// ─── SCM OAuth vs session 401 classification (#617) ─────────────────────────
// A 401 on an endpoint that proxies the external SCM API (using the stored OAuth
// token) means "reconnect your SCM token" and must NOT wipe the app session.
// Everything else — including the provider record and the OAuth-linkage
// endpoints — may be a real session failure, and is confirmed against /auth/me
// before anything is torn down (see classifySession401 below).

describe('isSCMOAuthFailureUrl', () => {
  it.each([
    '/api/v1/scm-providers/123/repositories',
    '/api/v1/scm-providers/123/repositories?search=vpc',
    '/api/v1/scm-providers/456/repositories/owner/repo/tags',
    '/api/v1/scm-providers/789/repositories/owner/repo/branches',
  ])('classifies external-SCM data endpoints as OAuth failures: %s', (url) => {
    expect(isSCMOAuthFailureUrl(url)).toBe(true)
  })

  it.each([
    ['provider list', '/api/v1/scm-providers'],
    ['provider record', '/api/v1/scm-providers/123'],
    ['oauth token status', '/api/v1/scm-providers/123/oauth/token'],
    ['oauth authorize', '/api/v1/scm-providers/123/oauth/authorize'],
    ['unrelated endpoint', '/api/v1/modules/search'],
    ['auth probe', '/api/v1/auth/me'],
    ['empty', ''],
  ])('classifies %s as a session failure (not OAuth)', (_label, url) => {
    expect(isSCMOAuthFailureUrl(url)).toBe(false)
  })
})

// ─── 401 → session-death classification (#677) ──────────────────────────────
// Only a request the *cookie session* authenticated can report that session's
// death. Everything else either carries its own credential or has to be
// confirmed against /auth/me before the tfr_csrf half of the double-submit pair
// is destroyed.

describe('classifySession401', () => {
  it.each([
    ['setup-wizard SetupToken', '/api/v1/setup/admin', { Authorization: 'SetupToken abc123' }],
    ['lowercase header name', '/api/v1/setup/complete', { authorization: 'SetupToken abc123' }],
    ['explicit Bearer', '/api/v1/modules', { Authorization: 'Bearer some-jwt' }],
  ])('treats %s as another credential, never session death', (_label, url, headers) => {
    expect(classifySession401({ url, headers })).toBe('other-credential')
  })

  it('reads an Authorization header off an AxiosHeaders-style object', () => {
    // Axios normalises headers into an AxiosHeaders instance whose values are
    // only reachable via .get() — a plain property read returns undefined and
    // would misclassify a SetupToken request as a dead session.
    const headers = { get: (name: string) => (name === 'Authorization' ? 'SetupToken abc' : null) }
    expect(classifySession401({ url: '/api/v1/setup/admin', headers })).toBe('other-credential')
    expect(classifySession401({ url: '/api/v1/setup/admin', headers: { get: () => null } })).toBe(
      'unconfirmed',
    )
  })

  it.each([
    '/api/v1/scm-providers/123/repositories',
    '/api/v1/scm-providers/456/repositories/owner/repo/tags',
  ])('treats an external-SCM proxy call as another credential: %s', (url) => {
    expect(classifySession401({ url })).toBe('other-credential')
  })

  it.each([
    ['bare path', '/api/v1/auth/me'],
    ['with a query string', '/api/v1/auth/me?fresh=1'],
  ])('treats the /auth/me session check itself as authoritative (%s)', (_label, url) => {
    expect(classifySession401({ url })).toBe('session-dead')
  })

  it.each([
    [
      'module SCM sync (backend 401s "not connected to this SCM provider")',
      '/api/v1/admin/modules/m1/scm/sync',
    ],
    ['an authorization failure returned as 401', '/api/v1/admin/users'],
    ['an SCM endpoint no URL heuristic knows about', '/api/v1/scm-providers/1/pull-requests'],
    ['no config url at all', ''],
  ])('leaves a cookie-authenticated 401 unconfirmed: %s', (_label, url) => {
    expect(classifySession401({ url })).toBe('unconfirmed')
  })

  it('leaves a missing config unconfirmed rather than assuming session death', () => {
    expect(classifySession401(undefined)).toBe('unconfirmed')
  })
})

// ─── Cross-origin CSRF configuration detection (#631) ───────────────────────

describe('checkCsrfOriginConfig', () => {
  const appOrigin = 'https://registry.example.com'

  it('returns null for an empty base URL (same-origin by construction)', () => {
    expect(checkCsrfOriginConfig('', appOrigin)).toBeNull()
  })

  it('returns null for a relative base path (same-origin)', () => {
    expect(checkCsrfOriginConfig('/api', appOrigin)).toBeNull()
  })

  it('returns null when the API base is the same origin', () => {
    expect(checkCsrfOriginConfig('https://registry.example.com/api', appOrigin)).toBeNull()
  })

  it('returns a warning when the API base is a different origin', () => {
    const warning = checkCsrfOriginConfig('https://api.other.com', appOrigin)
    expect(warning).toContain('api.other.com')
    expect(warning).toContain('X-CSRF-Token')
  })

  it('flags a different port on the same host as cross-origin', () => {
    expect(checkCsrfOriginConfig('https://registry.example.com:8443', appOrigin)).not.toBeNull()
  })
})
