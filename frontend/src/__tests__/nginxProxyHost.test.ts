import { describe, it, expect } from 'vitest'
import nginxEcsConf from '../../nginx-ecs.conf.template?raw'

/**
 * Regression test for the ACA/Cloud Run 404 on every proxied path except /api/.
 *
 * `${BACKEND_URL}` is a platform-routed ingress on those hosts: the platform
 * picks the target container app from the Host header of the proxied request.
 * `proxy_set_header Host $host` overwrites that with this server's public
 * hostname (registry.brunswick.com), which the platform cannot resolve to an
 * app, so it answers 404 "this Container App is stopped or does not exist"
 * before the backend is ever reached.
 *
 * Confirmed against the live environment: identical HTTP/1.1 requests to the
 * backend's internal FQDN returned 200 with the default Host and 404 with
 * `Host: registry.brunswick.com`.
 *
 * It broke /v1/ and /.well-known/ -- the Terraform registry protocol, i.e. what
 * `terraform init` actually calls -- plus /terraform/ and /swagger.json, while
 * /api/ kept working because it never set the header. The UI hid it: module and
 * provider pages read their version lists from /v1/, so the pages 404'd while
 * the catalog listing (on /api/) looked fine.
 *
 * Static check of the config, not a runtime one: it enforces the directive that
 * causes the bug when wrong, and cannot prove nginx routes correctly.
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

describe('nginx-ecs.conf.template proxied Host header', () => {
  const masked = maskComments(nginxEcsConf)

  it('never sends this server name as Host to the proxied backend', () => {
    expect(masked).not.toMatch(/proxy_set_header\s+Host\s+\$host\s*;/)
  })

  it('sets Host to the upstream wherever it is set at all', () => {
    const hostHeaders = masked.match(/proxy_set_header\s+Host\s+\S+\s*;/g) ?? []
    expect(hostHeaders.length).toBeGreaterThan(0)
    for (const directive of hostHeaders) {
      expect(directive).toMatch(/\$proxy_host/)
    }
  })

  it('preserves the public hostname in X-Forwarded-Host wherever Host is overridden', () => {
    const hostCount = (masked.match(/proxy_set_header\s+Host\s+\$proxy_host\s*;/g) ?? []).length
    const fwdCount = (masked.match(/proxy_set_header\s+X-Forwarded-Host\s+\$host\s*;/g) ?? []).length
    expect(fwdCount).toBe(hostCount)
  })

  it('does not count a commented-out directive as declared', () => {
    const conf = ['server {', '    # proxy_set_header Host $host;', '}'].join('\n')
    expect(maskComments(conf)).not.toMatch(/proxy_set_header\s+Host\s+\$host\s*;/)
  })
})
