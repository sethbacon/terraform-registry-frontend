import { describe, it, expect } from 'vitest'
import { isSCMOAuthFailureUrl, checkCsrfOriginConfig } from '../api/http'

// ─── SCM OAuth vs session 401 classification (#617) ─────────────────────────
// A 401 on an endpoint that proxies the external SCM API (using the stored OAuth
// token) means "reconnect your SCM token" and must NOT wipe the app session.
// Everything else — including the provider record and the OAuth-linkage
// endpoints — is a real session failure that redirects to /login.

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
