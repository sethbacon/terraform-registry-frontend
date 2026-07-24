import { describe, it, expect } from 'vitest'
import { encodeSegment } from '../http'

describe('encodeSegment', () => {
  // Regression guard (#614, CWE-116): axios does not URL-encode manually-built
  // path strings, so an unescaped identifier containing '#', '?', or '/' can
  // truncate the request at a fragment, inject a bogus query string, or shift
  // the path to a different resource than intended.
  it('encodes a fragment character so it cannot truncate the path', () => {
    expect(encodeSegment('1.0.0#evil')).toBe('1.0.0%23evil')
  })

  it('encodes a query-string character so it cannot inject query params', () => {
    expect(encodeSegment('name?admin=true')).toBe('name%3Fadmin%3Dtrue')
  })

  it('encodes a path separator so it cannot shift the target resource', () => {
    expect(encodeSegment('../other-namespace')).toBe('..%2Fother-namespace')
  })

  it('leaves a normal alphanumeric identifier unchanged', () => {
    expect(encodeSegment('hashicorp')).toBe('hashicorp')
  })
})
