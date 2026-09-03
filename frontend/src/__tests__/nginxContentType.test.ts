import { describe, it, expect } from 'vitest'
import nginxEcsConf from '../../nginx-ecs.conf.template?raw'
import nginxConf from '../../nginx.conf?raw'

/**
 * Regression test for `terraform init` failing against the network mirror with
 * "failed to query provider mirror ...: response has invalid Content-Type:
 * mime: unexpected content after media subtype".
 *
 * `add_header` APPENDS; it does not replace. The backend already sends
 * `Content-Type: application/json` on /terraform/, so an `add_header
 * Content-Type "application/json"` in that location emitted BOTH, comma-joined
 * as `application/json,application/json`. Go's mime parser rejects that, so
 * Terraform refused every provider the mirror served. Observed live before the
 * fix; the 404 path was worse still (`text/plain,application/json`).
 *
 * Browsers tolerate the duplicate, so the UI and curl looked healthy -- only a
 * strict parser noticed, which is why this reached production.
 *
 * Static check of the config, not a runtime one.
 */

/** Blank out `#` comments so a commented-out directive cannot satisfy a check. */
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

describe.each([
  ['nginx-ecs.conf.template', nginxEcsConf],
  ['nginx.conf', nginxConf],
])('%s Content-Type handling', (_name, conf) => {
  const masked = maskComments(conf)

  it('never sets Content-Type via add_header', () => {
    expect(masked).not.toMatch(/add_header\s+Content-Type\b/i)
  })

  it('leaves the mirror response Content-Type to the backend', () => {
    const mirror = masked.match(/location\s+\/terraform\/\s*\{[^}]*\}/)
    expect(mirror, 'expected a /terraform/ location block').not.toBeNull()
    expect(mirror![0]).not.toMatch(/add_header\s+Content-Type\b/i)
  })
})
