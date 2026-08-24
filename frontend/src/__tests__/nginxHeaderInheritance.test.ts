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

/**
 * Blank out `#` comments, replacing each with spaces of the SAME length so
 * every byte offset below stays valid.
 *
 * Without this the parser reads comment text as config, and both failure modes
 * make this guard report green while the invariant is broken:
 *
 *   1. The block regex is /location\s+([^{]+)\{/ and `[^{]+` spans NEWLINES.
 *      So the bare word "location" in a server-level comment opens a match that
 *      runs to the next `{` — the first real location block — and
 *      serverLevelOnly() then deletes that whole span BY INDEX, taking the
 *      server-level add_header directives out with it. The assertions then run
 *      against a config the parser has edited the headers out of. Latent until
 *      the first server-level comment said "location": every earlier such
 *      comment sat INSIDE a location block, which the parser skips.
 *
 *   2. A commented-out `# add_header X-Frame-Options ...` would satisfy the
 *      re-declaration check for a header nginx never sends.
 *
 * `#` inside a quoted value is literal to nginx, so quotes are tracked rather
 * than scanning for a bare `#`.
 */
function maskComments(conf: string): string {
  let out = ''
  let quote: string | null = null
  for (let i = 0; i < conf.length; i++) {
    const c = conf[i]
    if (quote) {
      out += c
      if (c === quote) quote = null
    } else if (c === '"' || c === "'") {
      quote = c
      out += c
    } else if (c === '#') {
      let j = i
      while (j < conf.length && conf[j] !== '\n') j++
      out += ' '.repeat(j - i)
      i = j - 1
    } else {
      out += c
    }
  }
  return out
}

/**
 * Extract `location <match> { ... }` blocks, brace-balanced, keeping the index
 * range of each body.
 *
 * The ranges matter: the server level is computed by removing these spans by
 * INDEX, not by `String.replace(body, '')`. Replace-by-content takes the first
 * textual match, which is not necessarily the block it came from — two blocks
 * with identical bodies, or a body that also occurs verbatim earlier, silently
 * strip the wrong region and take real server-level directives with them.
 */
function locationBlocks(
  rawConf: string,
): { match: string; body: string; start: number; end: number }[] {
  // Parse the MASKED text throughout: offsets are identical, so the ranges stay
  // valid against the raw config, and no directive is read out of a comment.
  const conf = maskComments(rawConf)
  const out: { match: string; body: string; start: number; end: number }[] = []
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
    out.push({ match: m[1].trim(), body: conf.slice(re.lastIndex, i - 1), start: m.index, end: i })
    // Skip past this block so a NESTED location is not also reported as a
    // top-level one, which would strip the same span twice.
    re.lastIndex = i
  }
  return out
}

/** The config with every location block removed, by index. Comments masked. */
function serverLevelOnly(rawConf: string): string {
  const conf = maskComments(rawConf)
  const blocks = locationBlocks(rawConf)
  let out = ''
  let cursor = 0
  for (const b of blocks) {
    out += conf.slice(cursor, b.start)
    cursor = b.end
  }
  return out + conf.slice(cursor)
}

describe('config parser', () => {
  // These two cases are why maskComments() exists. Both fail OPEN — the parser
  // silently mis-reads the config and every assertion above still passes — so
  // they are asserted directly rather than trusted to surface via the real
  // files. Case 1 is a live regression: it is exactly what the #743
  // proxy_hide_header comment did to nginx.conf.
  it('does not read a location block out of a comment', () => {
    const conf = [
      'server {',
      '    # proxy_hide_header inherits into every location below.',
      '    add_header X-Frame-Options "DENY" always;',
      '',
      '    location / {',
      '        try_files $uri /index.html;',
      '    }',
      '}',
    ].join('\n')

    expect(locationBlocks(conf).map((b) => b.match)).toEqual(['/'])
    expect(serverLevelOnly(conf)).toContain('add_header X-Frame-Options')
  })

  it('does not count a commented-out add_header as declared', () => {
    const conf = [
      'server {',
      '    location /x/ {',
      '        # add_header X-Frame-Options "DENY";',
      '    }',
      '}',
    ].join('\n')

    expect(locationBlocks(conf)[0].body).not.toContain('add_header')
    expect(serverLevelOnly(conf)).not.toContain('add_header')
  })
})

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
    const serverLevel = serverLevelOnly(conf)
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

  it('declares the CSP directives that do NOT fall back to default-src', () => {
    // CSP3 §6.1: only the FETCH directives fall back to default-src. base-uri
    // and form-action do not, so `default-src 'self'` does not cover them and
    // their absence is silent (#669).
    //
    // Without base-uri, an injected <base href="https://attacker/"> re-roots
    // every relative script and asset off-origin, straight through
    // `script-src 'self'`. Without form-action, an injected form posts
    // credentials anywhere without tripping `connect-src 'self'`.
    for (const directive of ["base-uri 'self'", "form-action 'self'"]) {
      expect(conf, `${name} CSP is missing ${directive}`).toContain(directive)
    }
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
