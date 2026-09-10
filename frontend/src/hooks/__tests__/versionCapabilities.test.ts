import { describe, it, expect } from 'vitest'

import { ociEnabledFrom } from '../useModuleDetail'
import type { VersionInfo } from '../../types'

/**
 * #921 — `capabilities.oci` was typed and read at the wrong nesting level, so
 * `ociEnabled` was always false and the OCI usage example never rendered.
 *
 * The fixture below is the backend's ACTUAL /version payload, copied from
 * internal/api/router.go's handler rather than written from the TypeScript
 * type. That direction matters: a hand-written fixture would have encoded the
 * same wrong assumption the bug came from, and passed.
 */
const REAL_VERSION_PAYLOAD = {
  version: '4.20.0',
  build_date: '2026-09-09T19:29:00Z',
  api_version: 'v1',
  crypto_mode: 'standard',
  default_language: 'en',
  protocols: { modules: 'v1', providers: 'v1', mirror: 'v1' },
  capabilities: { oci: true },
}

describe('/version capabilities (#921)', () => {
  it('reads oci from the shape the backend actually sends', () => {
    expect(ociEnabledFrom(REAL_VERSION_PAYLOAD as VersionInfo)).toBe(true)
  })

  it('is false when the backend reports oci disabled', () => {
    expect(
      ociEnabledFrom({ ...REAL_VERSION_PAYLOAD, capabilities: { oci: false } } as VersionInfo),
    ).toBe(false)
  })

  it('is false — not a crash — against a backend with no capabilities block', () => {
    const { capabilities, ...withoutCapabilities } = REAL_VERSION_PAYLOAD
    void capabilities
    expect(ociEnabledFrom(withoutCapabilities as VersionInfo)).toBe(false)
    expect(ociEnabledFrom(undefined)).toBe(false)
  })

  it('does NOT read a top-level oci field', () => {
    // The old shape. If someone re-adds `oci?: boolean` at the top level and
    // reads it, this fails rather than silently reviving the dead flag.
    const oldShape = { ...REAL_VERSION_PAYLOAD, capabilities: undefined, oci: true }
    expect(ociEnabledFrom(oldShape as unknown as VersionInfo)).toBe(false)
  })
})
