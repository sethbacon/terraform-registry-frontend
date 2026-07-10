import { describe, it, expect } from 'vitest'
import { sanitizeUrl } from '../sanitizeUrl'

describe('sanitizeUrl', () => {
  it('strips a token query param (the OIDC callback flow)', () => {
    const url = 'https://registry.example.com/auth/callback?token=super-secret-jwt'
    expect(sanitizeUrl(url)).toBe('https://registry.example.com/auth/callback')
  })

  it('strips code, state, and id_token query params', () => {
    const url =
      'https://registry.example.com/auth/callback?code=abc123&state=xyz789&id_token=eyJhbGci'
    expect(sanitizeUrl(url)).toBe('https://registry.example.com/auth/callback')
  })

  it('preserves non-sensitive query params alongside stripped ones', () => {
    const url = 'https://registry.example.com/modules?namespace=hashicorp&token=super-secret-jwt'
    expect(sanitizeUrl(url)).toBe('https://registry.example.com/modules?namespace=hashicorp')
  })

  it('returns the URL unchanged when there are no sensitive params', () => {
    const url = 'https://registry.example.com/modules?namespace=hashicorp&sort=downloads'
    expect(sanitizeUrl(url)).toBe(url)
  })

  it('returns the URL unchanged when there is no query string', () => {
    const url = 'https://registry.example.com/modules'
    expect(sanitizeUrl(url)).toBe(url)
  })

  it('strips a token from a root-relative path (Sentry navigation breadcrumb from/to)', () => {
    expect(sanitizeUrl('/auth/callback?token=super-secret-jwt')).toBe('/auth/callback')
  })

  it('preserves other params and the hash on a root-relative path', () => {
    expect(sanitizeUrl('/modules?namespace=hashicorp&token=super-secret-jwt#readme')).toBe(
      '/modules?namespace=hashicorp#readme',
    )
  })

  it('falls back to the original string for an unparsable URL', () => {
    expect(sanitizeUrl('not a url')).toBe('not a url')
  })
})
