import { describe, it, expect } from 'vitest'
import nginxConf from '../../nginx.conf?raw'
import nginxEcsConf from '../../nginx-ecs.conf.template?raw'
import { PROVIDER_MAX_BYTES } from '../components/FileDropZone'

/**
 * The proxy body limit must sit ABOVE the application's file limit (#766).
 *
 * `client_max_body_size` bounds the request BODY, not the file. A multipart
 * upload adds boundary delimiters, per-part `Content-Disposition` and
 * `Content-Type` headers and CRLFs on top of the archive, so a file of exactly
 * PROVIDER_MAX_BYTES produces a body a few hundred bytes larger. With the proxy
 * set to exactly 500m — "provisioned to match", as the old comment put it —
 * that upload passed the client-side check and the backend's own limit, and
 * then died at the edge with a bare 413 that names no cause.
 *
 * Equality is the bug, so `toBeGreaterThan` is the assertion. Three values in
 * three files have to stay ordered, and every one of them can be edited without
 * the others: the two configs have drifted before (the HSTS note in the ECS
 * template records it), and #672 was the application constants drifting from
 * each other.
 *
 * This is a STATIC check. It cannot prove nginx enforces the value — that needs
 * a container, which #691 tracks — but the ordering is what the bug was.
 */

const CONFIGS: [string, string][] = [
  ['nginx.conf', nginxConf],
  ['nginx-ecs.conf.template', nginxEcsConf],
]

/** nginx size suffixes: bare bytes, `k`/`K` kibibytes, `m`/`M` mebibytes. */
const UNIT_BYTES: Record<string, number> = {
  '': 1,
  k: 1024,
  m: 1024 * 1024,
}

function bodyLimitBytes(conf: string): number | null {
  // Ignore commented-out directives: a `#`-prefixed limit is not in force, and
  // reading one would let a real limit be deleted without this test noticing.
  const uncommented = conf.replace(/#[^\n]*/g, '')
  const match = uncommented.match(/client_max_body_size\s+(\d+)([kKmM]?)\s*;/)
  if (!match) return null
  return Number(match[1]) * UNIT_BYTES[match[2].toLowerCase()]
}

describe('nginx client_max_body_size (#766)', () => {
  it.each(CONFIGS)('%s declares a body limit', (_name, conf) => {
    // Positive control. If the directive is renamed or the regex rots,
    // bodyLimitBytes returns null and every comparison below would be skipped
    // rather than failed — a guard that stopped looking, reporting green.
    expect(bodyLimitBytes(conf)).not.toBeNull()
  })

  it.each(CONFIGS)('%s sits above the application file limit', (_name, conf) => {
    expect(bodyLimitBytes(conf)!).toBeGreaterThan(PROVIDER_MAX_BYTES)
  })

  it('both configs agree', () => {
    expect(bodyLimitBytes(nginxConf)).toBe(bodyLimitBytes(nginxEcsConf))
  })

  it('does not read a commented-out directive as the limit', () => {
    expect(bodyLimitBytes('# client_max_body_size 999m;')).toBeNull()
  })

  it('parses each nginx size suffix', () => {
    expect(bodyLimitBytes('client_max_body_size 512m;')).toBe(512 * 1024 * 1024)
    expect(bodyLimitBytes('client_max_body_size 64k;')).toBe(64 * 1024)
    expect(bodyLimitBytes('client_max_body_size 1048576;')).toBe(1048576)
  })
})
