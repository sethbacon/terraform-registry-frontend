import { describe, it, expect } from 'vitest'
import nginxConf from '../../nginx.conf?raw'
import nginxEcsConf from '../../nginx-ecs.conf.template?raw'

/**
 * nginx `add_header` is REPLACE-BY-LEVEL, not additive (#668):
 *
 *   "These directives are inherited from the previous configuration level if and
 *    only if there are no add_header directives defined on the current level."
 *
 * So a `location` block that sets ONE header silently drops every server-level
 * security header. `location /terraform/` set `Content-Type` and therefore
 * served with no `X-Frame-Options`, no `nosniff`, no CSP, no HSTS, no
 * `Referrer-Policy` and no `Permissions-Policy` — on the network-mirror path,
 * which proxies provider metadata from third-party upstream registries and is
 * the one same-origin path carrying content the operator does not author.
 *
 * The fix re-declares them inside the location, which means the config now
 * contains the same six headers twice. This test is what makes that duplication
 * safe: remove one and it fails, rather than the headers quietly vanishing from
 * a path nobody curls.
 *
 * It is a STATIC check of the config, not a runtime one. It cannot prove nginx
 * emits the headers (that needs a container); it enforces the invariant that
 * causes the bug. #691 tracks the runtime half.
 */

const REQUIRED = [
  'X-Frame-Options',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Strict-Transport-Security',
  'Content-Security-Policy',
  'Permissions-Policy',
] as const

/** Extract `location <match> { ... }` blocks, brace-balanced. */
function locationBlocks(conf: string): { match: string; body: string }[] {
  const out: { match: string; body: string }[] = []
  const re = /location\s+([^{]+)\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(conf)) !== null) {
    let depth = 1
    let i = re.lastIndex
    while (i < conf.length && depth > 0) {
      if (conf[i] === '{') depth++
      else if (conf[i] === '}') depth--
      i++
    }
    out.push({ match: m[1].trim(), body: conf.slice(re.lastIndex, i - 1) })
  }
  return out
}

const CONFIGS: [string, string][] = [
  ['nginx.conf', nginxConf],
  ['nginx-ecs.conf.template', nginxEcsConf],
]

describe.each(CONFIGS)('%s — add_header inheritance (#668)', (name, conf) => {
  it('parses at least one location block', () => {
    // An empty parse would make every assertion below vacuously true, which is
    // the failure mode this guard exists to prevent.
    expect(locationBlocks(conf).length).toBeGreaterThan(0)
  })

  it('declares every security header at the server level', () => {
    // Strip location bodies so we are looking at the server level only.
    let serverLevel = conf
    for (const { body } of locationBlocks(conf)) serverLevel = serverLevel.replace(body, '')
    for (const h of REQUIRED) {
      expect(serverLevel, `${name} lost server-level ${h}`).toContain(`add_header ${h}`)
    }
  })

  it('re-declares every security header in any location that sets add_header', () => {
    const offenders: string[] = []
    for (const { match, body } of locationBlocks(conf)) {
      if (!/add_header/.test(body)) continue // inherits cleanly — nothing to do
      const missing = REQUIRED.filter((h) => !body.includes(`add_header ${h}`))
      if (missing.length) offenders.push(`location ${match} is missing: ${missing.join(', ')}`)
    }
    expect(
      offenders,
      `${name}: a location that sets any add_header must re-declare ALL server-level ` +
        `security headers — nginx drops the inherited ones entirely (#668)`,
    ).toEqual([])
  })

  it('keeps the location CSP byte-identical to the server-level one', () => {
    // Two CSPs that drift are worse than one: the weaker one wins on whichever
    // path uses it, and nothing says which path that is.
    const all = [...conf.matchAll(/add_header Content-Security-Policy\s+(.*?);?\s*always;/g)].map(
      (m) => m[1].trim(),
    )
    expect(all.length, `${name} should declare CSP at server level and in /terraform/`).toBe(2)
    expect(new Set(all).size, `${name} has two DIFFERENT Content-Security-Policy values`).toBe(1)
  })
})
