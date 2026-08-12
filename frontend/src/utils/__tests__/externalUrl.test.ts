import { afterEach, describe, expect, it, vi } from 'vitest'
import { isSafeUrl } from '@4cloudguru/cloud-suite-ui'
import { allowedExternalOrigins, isSafeExternalUrl } from '../externalUrl'

vi.mock('@4cloudguru/cloud-suite-ui', async () => {
  const actual =
    await vi.importActual<typeof import('@4cloudguru/cloud-suite-ui')>('@4cloudguru/cloud-suite-ui')
  return { ...actual, isSafeUrl: vi.fn(actual.isSafeUrl) }
})

describe('isSafeExternalUrl', () => {
  it.each([
    'https://tsm.example.com',
    'https://tsm.example.com/path?x=1',
    'http://localhost:3000',
    '/relative/path',
    '#anchor',
  ])('accepts %s', (value) => {
    expect(isSafeExternalUrl(value)).toBe(true)
  })

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'mailto:a@b.com',
    'tel:+15551234567',
    '//evil.com',
    '/\\evil.com',
    '\\\\evil.com',
    // Embedded tab/newline/CR: the URL parser strips these, normalizing the value to the
    // protocol-relative "//evil.com" (off-origin redirect) at the sink — must be rejected.
    '/\t/evil.com',
    '/\n/evil.com',
    '/\r/evil.com',
    '/safe\t//evil.com',
    '',
    '   ',
    null,
    undefined,
    // No scheme and no leading /#. -- the URL constructor throws (invalid,
    // no base to resolve against) and the catch branch must reject it too.
    'not a url at all',
  ])('rejects %s', (value) => {
    expect(isSafeExternalUrl(value as string | null | undefined)).toBe(false)
  })

  it('does not throw and returns false for truthy non-string inputs', () => {
    expect(isSafeExternalUrl(123 as unknown as string)).toBe(false)
    expect(isSafeExternalUrl({} as unknown as string)).toBe(false)
  })
})

describe('isSafeExternalUrl origin allowlist (#559)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is inert when VITE_ALLOWED_EXTERNAL_ORIGINS is unset — behaviour unchanged', () => {
    vi.stubEnv('VITE_ALLOWED_EXTERNAL_ORIGINS', '')
    expect(isSafeExternalUrl('https://anything.example.com')).toBe(true)
  })

  it('rejects an origin that is not listed once an allowlist is configured', () => {
    vi.stubEnv('VITE_ALLOWED_EXTERNAL_ORIGINS', 'https://tsm.example.com')
    // The core of #559: a compromised backend handing us an attacker host.
    expect(isSafeExternalUrl('https://evil.example.com')).toBe(false)
  })

  it('accepts a listed origin', () => {
    vi.stubEnv('VITE_ALLOWED_EXTERNAL_ORIGINS', 'https://tsm.example.com')
    expect(isSafeExternalUrl('https://tsm.example.com/modules/x')).toBe(true)
  })

  it('accepts multiple listed origins and ignores surrounding whitespace', () => {
    vi.stubEnv('VITE_ALLOWED_EXTERNAL_ORIGINS', ' https://tsm.example.com , https://cdn.example.com ')
    expect(isSafeExternalUrl('https://cdn.example.com/logo.png')).toBe(true)
    expect(isSafeExternalUrl('https://tsm.example.com')).toBe(true)
  })

  it('always accepts the app\'s own origin without listing it', () => {
    vi.stubEnv('VITE_ALLOWED_EXTERNAL_ORIGINS', 'https://tsm.example.com')
    expect(isSafeExternalUrl(`${window.location.origin}/admin`)).toBe(true)
  })

  it('matches on full origin, so a different port or scheme is rejected', () => {
    vi.stubEnv('VITE_ALLOWED_EXTERNAL_ORIGINS', 'https://tsm.example.com')
    expect(isSafeExternalUrl('https://tsm.example.com:8443')).toBe(false)
    expect(isSafeExternalUrl('http://tsm.example.com')).toBe(false)
  })

  it('does not let a lookalike host through on a prefix match', () => {
    vi.stubEnv('VITE_ALLOWED_EXTERNAL_ORIGINS', 'https://tsm.example.com')
    expect(isSafeExternalUrl('https://tsm.example.com.evil.test')).toBe(false)
    expect(isSafeExternalUrl('https://evil.test/?x=https://tsm.example.com')).toBe(false)
  })

  it('still accepts relative paths and anchors when an allowlist is configured', () => {
    vi.stubEnv('VITE_ALLOWED_EXTERNAL_ORIGINS', 'https://tsm.example.com')
    expect(isSafeExternalUrl('/admin/modules')).toBe(true)
    expect(isSafeExternalUrl('#section')).toBe(true)
  })

  it('still rejects dangerous schemes regardless of the allowlist', () => {
    vi.stubEnv('VITE_ALLOWED_EXTERNAL_ORIGINS', 'https://tsm.example.com')
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeExternalUrl('//evil.example.com')).toBe(false)
  })

  it('drops a malformed allowlist entry instead of widening the allowlist', () => {
    // A typo must not degrade to "allow everything".
    vi.stubEnv('VITE_ALLOWED_EXTERNAL_ORIGINS', 'not a url,https://tsm.example.com')
    expect(allowedExternalOrigins()).toEqual(['https://tsm.example.com'])
    expect(isSafeExternalUrl('https://evil.example.com')).toBe(false)
  })

  it('normalises a configured entry that carries a path', () => {
    vi.stubEnv('VITE_ALLOWED_EXTERNAL_ORIGINS', 'https://tsm.example.com/some/path')
    expect(allowedExternalOrigins()).toEqual(['https://tsm.example.com'])
    expect(isSafeExternalUrl('https://tsm.example.com/other')).toBe(true)
  })
})

// Regression coverage for #102: isSafeExternalUrl must compose the shared isSafeUrl rather than
// re-deriving its own copy of the control-character/protocol-relative/relative-path checks. Each
// test here would fail if a future edit un-does that composition.
describe('isSafeExternalUrl delegates to the shared isSafeUrl (#102)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.mocked(isSafeUrl).mockClear()
  })

  it('calls the shared isSafeUrl with the raw value', () => {
    isSafeExternalUrl('  https://tsm.example.com  ')
    expect(vi.mocked(isSafeUrl)).toHaveBeenCalledWith('  https://tsm.example.com  ')
  })

  it('rejects whatever the shared isSafeUrl rejects, even an otherwise-allowlisted URL', () => {
    vi.stubEnv('VITE_ALLOWED_EXTERNAL_ORIGINS', 'https://tsm.example.com')
    vi.mocked(isSafeUrl).mockReturnValueOnce(false)
    expect(isSafeExternalUrl('https://tsm.example.com')).toBe(false)
  })

  it('still narrows to http(s) after isSafeUrl accepts a mailto: URL', () => {
    // Proves the app doesn't just forward isSafeUrl's answer wholesale -- it composes its own
    // scheme narrowing on top, since isSafeUrl itself allows mailto:/tel:.
    vi.mocked(isSafeUrl).mockReturnValueOnce(true)
    expect(isSafeExternalUrl('mailto:a@b.com')).toBe(false)
  })

  it('still applies the origin allowlist after isSafeUrl accepts', () => {
    // Proves the allowlist layer isn't bypassed by isSafeUrl's own answer either.
    vi.stubEnv('VITE_ALLOWED_EXTERNAL_ORIGINS', 'https://tsm.example.com')
    vi.mocked(isSafeUrl).mockReturnValueOnce(true)
    expect(isSafeExternalUrl('https://evil.example.com')).toBe(false)
  })
})
