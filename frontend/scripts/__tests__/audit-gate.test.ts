import { describe, it, expect } from 'vitest'
// @ts-expect-error -- plain ESM script, no type declarations by design
import { triage, render, loadExceptions } from '../audit-gate.mjs'

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
