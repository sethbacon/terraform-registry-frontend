import { describe, it, expect, vi, afterEach } from 'vitest'
import i18n from '../i18n'

// setupTests.ts already imports and initializes '../i18n' before every test
// file runs, so this test exercises the live singleton instance rather than
// re-initializing i18next.

describe('i18n missing-key handling (#635)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to a neutral placeholder instead of rendering the raw key path', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = i18n.t('this.key.does.not.exist.anywhere')

    expect(result).toBe('')
    expect(result).not.toBe('this.key.does.not.exist.anywhere')
    warnSpy.mockRestore()
  })

  it('logs the miss for telemetry/debugging', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    i18n.t('another.missing.key')

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('another.missing.key'))
  })

  it('preserves an explicit defaultValue supplied by the call site', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = i18n.t('yet.another.missing.key', { defaultValue: 'Fallback text' })

    expect(result).toBe('Fallback text')
    warnSpy.mockRestore()
  })

  it('still resolves real keys normally', () => {
    // Sanity check: the handler must not interfere with keys that exist.
    const result = i18n.t('admin.apiKeys.pageTitle')
    expect(result).not.toBe('')
    expect(result).not.toBe('admin.apiKeys.pageTitle')
  })
})
