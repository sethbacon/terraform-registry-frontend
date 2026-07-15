import { describe, expect, it } from 'vitest'
import { isSafeExternalUrl } from '../externalUrl'

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
  ])('rejects %s', (value) => {
    expect(isSafeExternalUrl(value as string | null | undefined)).toBe(false)
  })

  it('does not throw and returns false for truthy non-string inputs', () => {
    expect(isSafeExternalUrl(123 as unknown as string)).toBe(false)
    expect(isSafeExternalUrl({} as unknown as string)).toBe(false)
  })
})
