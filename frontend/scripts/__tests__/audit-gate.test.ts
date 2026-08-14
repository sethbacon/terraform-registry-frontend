import { describe, it, expect } from 'vitest'
// @ts-expect-error -- plain ESM script, no type declarations by design
import { triage, triageOsv, triageReport, render, loadExceptions, compareVersions } from '../audit-gate.mjs'

type Fix = boolean | { name: string; version: string; isSemVerMajor: boolean }

function report(
  name: string,
  { severity = 'high', dev = false, fix = false as Fix, url = 'https://github.com/advisories/GHSA-test-0000' } = {},
) {
  return {
    vulnerabilities: {
      [name]: {
        severity,
        dev,
        fixAvailable: fix,
        via: [{ title: 'Example advisory', url }],
      },
    },
  }
}

const NO_EXCEPTIONS = { byAdvisory: new Map(), byPackage: new Map() }

describe('audit-gate triage', () => {
  it('blocks when a non-breaking fix is available in a production dependency', () => {
    const { blocking, advisory, accepted } = triage(
      report('lib', { fix: { name: 'lib', version: '1.2.4', isSemVerMajor: false } }),
      NO_EXCEPTIONS,
    )
    expect(blocking).toHaveLength(1)
    expect(advisory).toHaveLength(0)
    expect(accepted).toHaveLength(0)
  })

  it('does not block when the only fix is a breaking major (the react-router shape)', () => {
    const { blocking, advisory } = triage(
      report('react-router', { fix: { name: 'react-router-dom', version: '7.11.0', isSemVerMajor: true } }),
      NO_EXCEPTIONS,
    )
    expect(blocking).toHaveLength(0)
    expect(advisory[0].why).toBe('only a semver-major (breaking) fix is available')
  })

  it('does not block when no fix has been published', () => {
    const { blocking, advisory } = triage(report('lib', { fix: false }), NO_EXCEPTIONS)
    expect(blocking).toHaveLength(0)
    expect(advisory[0].why).toBe('no fixed version published')
  })

  it('does not block on dev-only dependencies, which never ship', () => {
    const { blocking, advisory } = triage(
      report('brace-expansion', { dev: true, fix: { name: 'x', version: '2', isSemVerMajor: false } }),
      NO_EXCEPTIONS,
    )
    expect(blocking).toHaveLength(0)
    expect(advisory[0].why).toBe('dev-only dependency; not shipped to users')
  })

  it('routes a documented exception to accepted, even when it would otherwise block', () => {
    const exceptions = {
      byAdvisory: new Map([['GHSA-qwww-vcr4-c8h2', { reason: 'RSC mode unused', review_by: '2026-10-30' }]]),
      byPackage: new Map(),
    }
    const { blocking, advisory, accepted } = triage(
      report('react-router', {
        fix: { name: 'r', version: '1', isSemVerMajor: false },
        url: 'https://github.com/advisories/GHSA-qwww-vcr4-c8h2',
      }),
      exceptions,
    )
    expect(blocking).toHaveLength(0)
    expect(advisory).toHaveLength(0)
    expect(accepted[0].reason).toBe('RSC mode unused')
  })

  it('matches an exception by package name for transitive rows that carry no advisory id', () => {
    // npm reports react-router-dom's `via` as the string "react-router", so the
    // row has no advisory id — only the package-name fallback can catch it.
    const exceptions = {
      byAdvisory: new Map(),
      byPackage: new Map([['react-router-dom', { reason: 'inherits parent advisory', review_by: '2026-10-30' }]]),
    }
    const data = {
      vulnerabilities: {
        'react-router-dom': {
          severity: 'high',
          dev: false,
          fixAvailable: { name: 'react-router-dom', version: '7.11.0', isSemVerMajor: true },
          via: ['react-router'],
        },
      },
    }
    const { accepted } = triage(data, exceptions)
    expect(accepted).toHaveLength(1)
  })

  it('ignores advisories below the high threshold', () => {
    const { blocking, advisory, accepted } = triage(report('lib', { severity: 'moderate' }), NO_EXCEPTIONS)
    expect([blocking, advisory, accepted].every((l) => l.length === 0)).toBe(true)
  })

  it('renders a clean report', () => {
    expect(render({ blocking: [], advisory: [], accepted: [] })).toContain('No high or critical advisories')
  })

  it('treats a missing exceptions file as no exceptions rather than an error', () => {
    const { byAdvisory, byPackage } = loadExceptions('does-not-exist.json')
    expect(byAdvisory.size).toBe(0)
    expect(byPackage.size).toBe(0)
  })
})

describe('audit-gate OSV mode', () => {
  const osvReport = (name: string, installed: string, fixed: string | null, id = 'GHSA-test-1111') => ({
    results: [
      {
        source: { path: 'frontend/package-lock.json' },
        packages: [
          {
            package: { name, version: installed, ecosystem: 'npm' },
            vulnerabilities: [
              {
                id,
                summary: 'Example advisory',
                database_specific: { severity: 'HIGH' },
                affected: [
                  {
                    package: { name },
                    ranges: [
                      {
                        type: 'SEMVER',
                        events: fixed ? [{ introduced: '0' }, { fixed }] : [{ introduced: '0' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  })

  const NONE = { byAdvisory: new Map(), byPackage: new Map() }

  it('blocks a same-major (non-breaking) fix', () => {
    const { blocking } = triageOsv(osvReport('brace-expansion', '5.0.7', '5.0.8'), NONE)
    expect(blocking).toHaveLength(1)
    expect(blocking[0].fix.version).toBe('5.0.8')
  })

  it('does not block when the only fix crosses a major — the react-router case', () => {
    // OSV reports a fixed version (8.3.0) for react-router 7.18.1, so a naive
    // "a fix exists" rule would block forever on a breaking upgrade that also
    // breaks the suite-ui pin. npm audit calls the same advisory breaking.
    const { blocking, advisory } = triageOsv(osvReport('react-router', '7.18.1', '8.3.0'), NONE)
    expect(blocking).toHaveLength(0)
    expect(advisory[0].why).toBe('only a semver-major (breaking) fix is available')
  })

  it('does not block when OSV publishes no fixed version', () => {
    const { blocking, advisory } = triageOsv(osvReport('lib', '1.0.0', null), NONE)
    expect(blocking).toHaveLength(0)
    expect(advisory[0].why).toBe('no fixed version published')
  })

  it('honours the shared exceptions file by advisory id', () => {
    const exceptions = {
      byAdvisory: new Map([['GHSA-qwww-vcr4-c8h2', { reason: 'RSC mode unused', review_by: '2026-10-30' }]]),
      byPackage: new Map(),
    }
    const { blocking, accepted } = triageOsv(
      osvReport('react-router', '7.18.1', '7.19.0', 'GHSA-qwww-vcr4-c8h2'),
      exceptions,
    )
    expect(blocking).toHaveLength(0)
    expect(accepted[0].reason).toBe('RSC mode unused')
  })

  it('ignores advisories below the high threshold', () => {
    const r = osvReport('lib', '1.0.0', '1.0.1')
    r.results[0].packages[0].vulnerabilities[0].database_specific.severity = 'MODERATE'
    const { blocking, advisory, accepted } = triageOsv(r, NONE)
    expect([blocking, advisory, accepted].every((l) => l.length === 0)).toBe(true)
  })

  // An advisory that spans several release lines publishes one fix per line.
  // Taking whichever OSV listed first named a fix from an unrelated major and
  // the gate then wrote the finding off as "breaking only" — silently NOT
  // blocking on a high with a patch-level fix. Real ranges, from this repo's
  // own frontend/package-lock.json at e52794c~1.
  describe('minimal upgrade selection', () => {
    const multiLine = (installed: string, fixes: string[]) => ({
      results: [
        {
          source: { path: 'frontend/package-lock.json' },
          packages: [
            {
              package: { name: 'brace-expansion', version: installed, ecosystem: 'npm' },
              vulnerabilities: [
                {
                  id: 'GHSA-mh99-v99m-4gvg',
                  summary: 'Example advisory',
                  database_specific: { severity: 'HIGH' },
                  affected: [
                    {
                      package: { name: 'brace-expansion' },
                      ranges: fixes.map((fixed) => ({ type: 'SEMVER', events: [{ introduced: '0' }, { fixed }] })),
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })

    it.each([
      ['1.1.16', '1.1.17'],
      ['5.0.7', '5.0.8'],
      ['3.0.1', '3.0.3'],
    ])('picks the lowest fix above %s, not the first listed', (installed, expected) => {
      const { blocking } = triageOsv(multiLine(installed, ['5.0.8', '3.0.3', '2.1.3', '1.1.17']), NONE)
      expect(blocking).toHaveLength(1)
      expect(blocking[0].fix.version).toBe(expected)
    })

    it('still reports a breaking-only fix as breaking', () => {
      const { blocking, advisory } = triageOsv(multiLine('3.8.3', ['4.3.9']), NONE)
      expect(blocking).toHaveLength(0)
      expect(advisory[0].fix.version).toBe('4.3.9')
      expect(advisory[0].why).toBe('only a semver-major (breaking) fix is available')
    })

    it('falls back to the first published fix when none is an upgrade', () => {
      const { advisory } = triageOsv(multiLine('9.9.9', ['1.1.17']), NONE)
      expect(advisory[0].fix.version).toBe('1.1.17')
    })

    it.each([
      ['1.1.16', '1.1.17', -1],
      ['1.1.17', '1.1.16', 1],
      ['1.1.17', '1.1.17', 0],
      ['2.1.3', '10.0.0', -1],
      ['1.2', '1.2.0', 0],
    ])('compareVersions(%s, %s) sorts numerically', (a, b, sign) => {
      expect(Math.sign(compareVersions(a, b))).toBe(sign)
    })
  })

  it('carries the installed version and CVSS score for the issue filer', () => {
    const r = osvReport('nanoid', '3.3.16', '3.3.18', 'GHSA-2v37-7h3g-55p8')
    r.results[0].packages[0].groups = [{ ids: ['GHSA-2v37-7h3g-55p8'], aliases: [], max_severity: '8.2' }]
    const { blocking } = triageOsv(r, NONE)
    expect(blocking[0].installed).toBe('3.3.16')
    expect(blocking[0].cvss).toBe('8.2')
  })

  it('leaves cvss empty when the scanner published no score', () => {
    const { blocking } = triageOsv(osvReport('lib', '1.0.0', '1.0.1'), NONE)
    expect(blocking[0].cvss).toBe('')
  })

  it('auto-detects report format so callers need not declare the scanner', () => {
    const osv = triageReport(osvReport('brace-expansion', '5.0.7', '5.0.8'), NONE)
    expect(osv.blocking).toHaveLength(1)

    const npm = triageReport(
      { vulnerabilities: { lib: { severity: 'high', dev: false, fixAvailable: false, via: [{ title: 't', url: 'u/GHSA-x' }] } } },
      NONE,
    )
    expect(npm.advisory).toHaveLength(1)
  })
})
