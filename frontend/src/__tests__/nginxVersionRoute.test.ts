import { describe, it, expect } from 'vitest'
import nginxEcsConf from '../../nginx-ecs.conf.template?raw'
import nginxConf from '../../nginx.conf?raw'

/**
 * Regression test for the About box rendering an empty "Backend v" / "API
 * version" on ACA/Cloud Run.
 *
 * `nginx-ecs.conf.template` had no `location /version`, unlike `nginx.conf`.
 * `/version` fell through to the SPA catch-all (`location /`), which served
 * `index.html` with a 200. `getVersionInfo()` treated that HTML string as a
 * truthy `backendVersion`, so `backendVersion.version` and
 * `backendVersion.api_version` were both `undefined` and rendered as empty via
 * i18next interpolation, with no error anywhere to notice.
 *
 * Static check of the config, not a runtime one: it enforces the directive
 * that causes the bug when absent, and cannot prove nginx routes correctly.
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
])('%s /version route', (_name, conf) => {
  const masked = maskComments(conf)

  it('proxies /version to the backend instead of falling through to the SPA', () => {
    expect(masked).toMatch(/location\s+\/version\s*\{[^}]*proxy_pass\s+[^;]*\/version\s*;/)
  })

  it('does not count a commented-out location as declared', () => {
    const conf = [
      'server {',
      '    # location /version { proxy_pass http://backend/version; }',
      '}',
    ].join('\n')
    expect(maskComments(conf)).not.toMatch(/location\s+\/version\s*\{[^}]*proxy_pass/)
  })
})
