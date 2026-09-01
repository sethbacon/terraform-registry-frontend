/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { ORGANIZATION_HEADER } from '@4cloudguru/cloud-suite-ui'

import { http, setActingOrganization } from '../api/http'

/**
 * GUARD: a create that must name an organization cannot leave this frontend
 * without naming one.
 *
 * # What it is guarding against
 *
 * Every registry route that creates an organization-owned row resolves the
 * ACTING ORGANIZATION before it inserts (terraform-registry-backend#1011, suite
 * terraform-state-manager-backend#437): an explicit body organization_id, else the
 * X-Organization-Id header, else the caller's single in-scope organization.
 * A multi-organization caller — and a platform administrator, unconditionally —
 * who names nothing is refused with 400. The header is attached in ONE
 * interceptor, so a call site that reaches the network another way simply
 * omits it, and the omission is invisible until a multi-organization user
 * tries to write, which single-organization development never does.
 *
 * # Why the assertion is where it is
 *
 * Asserting per call site proves something about today's call sites and
 * nothing about tomorrow's. The property that holds the line is a pair:
 *
 *   1. THE DOOR ALWAYS STAMPS. The interceptor attaches the header for every
 *      method and every url, so a route added tomorrow is covered by
 *      construction.
 *   2. THERE IS ONLY ONE DOOR. No module outside services/api/http.ts may
 *      reach the API another way, so there is nowhere for a request to be
 *      issued that the interceptor does not see.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '..', '..')

type RequestConfig = { method?: string; url?: string; headers?: Record<string, string> }
type Handlers = { handlers: { fulfilled: (c: RequestConfig) => RequestConfig }[] }
const runInterceptor = (config: RequestConfig): RequestConfig =>
  (http.interceptors.request as unknown as Handlers).handlers[0].fulfilled(config)

const ACTING = '11111111-1111-4111-8111-111111111111'

afterEach(() => setActingOrganization(null))

/**
 * The routes whose handler resolves an acting organization before it writes,
 * as of backend internal/api (#1011). A readability aid, not the load-bearing
 * part — the property test below covers any url at all.
 */
const STAMPED_ROUTES: [string, string][] = [
  ['POST', '/api/v1/admin/mirrors'],
  ['POST', '/api/v1/scm-providers'],
  ['POST', '/api/v1/admin/modules/create'],
  ['POST', '/api/v1/modules'],
  ['POST', '/api/v1/providers'],
  ['POST', '/api/v1/apikeys'],
  ['POST', '/api/v1/admin/policies'],
]

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'locales' || entry.name === '__tests__') continue
      sourceFiles(full, acc)
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      acc.push(full)
    }
  }
  return acc
}

/** Source with comments and type-only imports removed: neither can reach the network. */
function executableSource(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
    .split('\n')
    .filter((line) => !/^\s*import type\b/.test(line))
    .join('\n')
}

describe('GUARD: every organization-stamped create carries the acting organization', () => {
  it.each(STAMPED_ROUTES)('%s %s carries the header', (method, url) => {
    setActingOrganization(ACTING)
    const out = runInterceptor({ method: method.toLowerCase(), url, headers: {} })
    expect(
      out.headers?.[ORGANIZATION_HEADER],
      `${method} ${url} would be refused with "specify organization_id or send the X-Organization-Id header"`,
    ).toBe(ACTING)
  })

  // Every route above is issued through the shared client today. If one stops
  // being, the interceptor never sees it and the assertion above goes vacuous
  // while staying green — so pin that the api modules are where these urls live.
  it.each(STAMPED_ROUTES)('%s %s is issued through the shared client', (_method, url) => {
    const apiDir = path.join(SRC, 'services', 'api')
    const sources = readdirSync(apiDir)
      .filter((f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f))
      .map((f) => readFileSync(path.join(apiDir, f), 'utf8'))
      .join('\n')
    expect(sources, `${url} is no longer issued from services/api/*.ts`).toContain(`'${url}'`)
  })
})

/**
 * THE BLIND AXIS. The realistic way this breaks is not a deleted interceptor —
 * it is someone narrowing it, because sending an organization on a GET looks
 * redundant. Narrow it to mutations and every read stops carrying it, which is
 * the header /auth/me needs to answer with the SELECTED organization's scopes.
 * Narrow it to a url prefix and the next route family is born broken. So the
 * property, not the examples: for ANY method and ANY url, if there is an acting
 * organization the header goes out.
 */
describe('GUARD: the interceptor stamps unconditionally, not selectively', () => {
  const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', undefined]
  const URLS = [
    '/api/v1/admin/mirrors',
    '/api/v1/auth/me',
    '/health',
    '/api/v2/something-that-does-not-exist-yet',
    '',
    undefined,
  ]
  for (const method of METHODS) {
    for (const url of URLS) {
      it(`stamps ${method ?? '(default)'} ${url === undefined ? '(no url)' : url || '(empty)'}`, () => {
        setActingOrganization(ACTING)
        const out = runInterceptor({ method, url, headers: {} })
        expect(out.headers?.[ORGANIZATION_HEADER]).toBe(ACTING)
      })
    }
  }

  // The converse, so the guard cannot be satisfied by hardcoding a value: with
  // nothing selected nothing is sent. Inventing a value here would be the
  // tenancy bug, not the fix.
  it('sends nothing when no organization is selected', () => {
    setActingOrganization(null)
    const out = runInterceptor({ method: 'post', url: '/api/v1/admin/mirrors', headers: {} })
    expect(out.headers?.[ORGANIZATION_HEADER]).toBeUndefined()
  })

  // The name is the shared constant, not a hand-typed string: two ends
  // spelling it differently is the exact defect the shared package closes.
  it('spells the header with the shared constant', () => {
    const source = readFileSync(path.join(SRC, 'services', 'api', 'http.ts'), 'utf8')
    expect(source).toContain('ORGANIZATION_HEADER')
    expect(source).not.toMatch(/['"`]X-Organization-Id['"`]/)
    expect(ORGANIZATION_HEADER).toBe('X-Organization-Id')
  })
})

/**
 * THE TRANSPORT MONOPOLY. An unconditional interceptor guards nothing if a
 * module can reach the API without going through it. Every legal spelling of
 * "escape the client" is matched — axios by its module specifier (static,
 * dynamic or require), fetch on a non-word boundary (skips refetch/prefetch
 * but not a qualified receiver), XMLHttpRequest and sendBeacon.
 */
describe('GUARD: services/api/http.ts is the only way out of this frontend', () => {
  // Each entry is a file that legitimately reaches the network another way,
  // with the reason. BIDIRECTIONAL: an entry whose escape has since been
  // removed fails too, so the allowlist cannot accumulate stale permissions.
  const ALLOWED = new Map<string, string>([
    [
      'services/api/http.ts',
      'the client itself, and the one place the interceptor attaches the header',
    ],
    [
      'utils/errors.ts',
      'imports axios only for isAxiosError narrowing of errors the client already produced; it issues nothing',
    ],
    [
      'services/errorReporting.ts',
      'ships error reports to a telemetry DSN, not to the registry API; nothing there is organization-owned',
    ],
    [
      'services/performanceReporting.ts',
      'ships performance beacons to a telemetry DSN, not to the registry API; nothing there is organization-owned',
    ],
  ])

  const ESCAPES: [string, RegExp][] = [
    ['loads axios directly', /['"]axios['"]/],
    ['calls fetch', /(?<!\w)fetch\s*\(/],
    ['uses XMLHttpRequest', /\bXMLHttpRequest\b/],
    ['uses navigator.sendBeacon', /\bsendBeacon\s*\(/],
  ]

  const files = sourceFiles(SRC)

  // A guard that enumerated nothing would pass for the wrong reason.
  it('found the source tree it is supposed to be checking', () => {
    expect(files.length).toBeGreaterThan(100)
    expect(files.some((f) => f.endsWith(path.join('services', 'api', 'http.ts')))).toBe(true)
  })

  it('no module outside the allowlist reaches the network directly', () => {
    const offenders: string[] = []
    for (const file of files) {
      const rel = path.relative(SRC, file).split(path.sep).join('/')
      if (ALLOWED.has(rel)) continue
      const source = executableSource(readFileSync(file, 'utf8'))
      for (const [what, pattern] of ESCAPES) {
        if (pattern.test(source)) {
          offenders.push(
            `${rel} ${what} — it would bypass the interceptor that attaches ${ORGANIZATION_HEADER}. ` +
              `Route it through services/api/http.ts, or add it to ALLOWED with the reason it needs no acting organization.`,
          )
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('every allowlisted exemption is still needed', () => {
    for (const [rel, why] of ALLOWED) {
      const source = executableSource(readFileSync(path.join(SRC, rel), 'utf8'))
      const escapes = ESCAPES.some(([, pattern]) => pattern.test(source))
      expect(
        escapes,
        `${rel} no longer reaches the network directly, so its exemption ("${why}") is stale. Remove it.`,
      ).toBe(true)
    }
  })
})
