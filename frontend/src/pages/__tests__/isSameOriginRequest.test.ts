import { describe, expect, it } from 'vitest'

import { isSameOriginRequest } from '../ApiDocumentation'

// Issue #697 — the rule that bounds the Swagger CSRF echo, tested directly.
//
// The interceptor using it is created inside the component via useCallback, so
// through the component it is only reachable via a rendered SwaggerUI mock.
// Testing the decision here keeps the rule covered even if that mock's shape
// changes.
describe('isSameOriginRequest', () => {
  it('accepts same-origin absolute and relative targets', () => {
    expect(isSameOriginRequest('/api/v1/modules')).toBe(true)
    expect(isSameOriginRequest('api/v1/modules')).toBe(true)
    expect(isSameOriginRequest(`${window.location.origin}/api/v1/modules`)).toBe(true)
  })

  it('rejects cross-origin targets', () => {
    expect(isSameOriginRequest('https://evil.example.com/x')).toBe(false)
    // Protocol-relative: resolves against the app's scheme but a foreign host.
    expect(isSameOriginRequest('//evil.example.com/x')).toBe(false)
    // Same host, different port — still a different origin.
    expect(isSameOriginRequest('http://localhost:9999/x')).toBe(false)
  })

  it('fails closed on values that are not usable URLs', () => {
    // Without the header the request is rejected by the CSRF middleware, which
    // is visible; attaching it anyway would be a silent disclosure.
    expect(isSameOriginRequest(undefined)).toBe(false)
    expect(isSameOriginRequest('')).toBe(false)
    expect(isSameOriginRequest('http://[')).toBe(false)
    expect(isSameOriginRequest(42)).toBe(false)
    expect(isSameOriginRequest(null)).toBe(false)
  })
})
