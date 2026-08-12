import { describe, it, expect } from 'vitest'
// Vite's `?raw` import, following src/__tests__/routeScopeParity.test.ts: it
// needs no @types/node and no path arithmetic relative to the test's runtime
// location, and it is resolved by the same bundler that builds the app, so the
// text read here is unambiguously the source that ships.
import moduleHookSource from '../../hooks/useModuleDetail.ts?raw'
import providerHookSource from '../../hooks/useProviderDetail.ts?raw'
import { compareVersionsDesc, sortByVersionDesc } from '../semver'

/** Sorts bare version strings, so the cases below read as the list they describe. */
function order(versions: string[]): string[] {
  return sortByVersionDesc(versions.map((version) => ({ version }))).map((v) => v.version)
}

describe('sortByVersionDesc', () => {
  it('orders by numeric precedence, not lexically', () => {
    // '1.10.0' beats '1.2.0' numerically but loses as a string — the case that
    // rules out ever replacing this with a plain localeCompare.
    expect(order(['1.0.0', '2.0.0', '1.10.0', '1.2.0'])).toEqual([
      '2.0.0',
      '1.10.0',
      '1.2.0',
      '1.0.0',
    ])
  })

  it('ignores a leading v', () => {
    expect(order(['v1.0.0', '2.0.0', 'v10.0.0'])).toEqual(['v10.0.0', '2.0.0', 'v1.0.0'])
  })

  it('does not mutate its input', () => {
    const input = [{ version: '1.0.0' }, { version: '2.0.0' }]
    sortByVersionDesc(input)
    expect(input.map((v) => v.version)).toEqual(['1.0.0', '2.0.0'])
  })

  it('returns an empty list unchanged', () => {
    expect(order([])).toEqual([])
  })

  it('keeps equal versions in input order', () => {
    // Two records can share a version (e.g. a re-published row). Sort stability
    // is the only thing that makes the rendered list deterministic here.
    const input = [
      { version: '1.0.0', id: 'a' },
      { version: '1.0.0', id: 'b' },
    ]
    expect(sortByVersionDesc(input).map((v) => v.id)).toEqual(['a', 'b'])
  })
})

describe('sortByVersionDesc — pre-releases', () => {
  it('puts a stable release ahead of a pre-release of the same version', () => {
    // The #673 divergence itself. useProviderDetail had the stable-first
    // tiebreak and useModuleDetail did not, and neither ordered pre-releases
    // against each other, so this list rendered three different ways depending
    // on the page and on the order the API happened to return. The hook tests
    // in useModuleDetail.test.ts and useProviderDetail.test.tsx assert this
    // exact fixture and expectation, which is what pins the two together.
    expect(order(['1.0.0', '2.0.0-beta.2', '2.0.0-beta.10', '2.0.0-rc.1', '2.0.0'])).toEqual([
      '2.0.0',
      '2.0.0-rc.1',
      '2.0.0-beta.10',
      '2.0.0-beta.2',
      '1.0.0',
    ])
  })

  it('orders pre-releases by semver.org §11.4 precedence', () => {
    // The precedence chain published in the semver spec, fed in reverse so a
    // comparator that returned 0 for every pre-release pair (what both original
    // copies did) would fail rather than pass on input order.
    const newestFirst = [
      '1.0.0',
      '1.0.0-rc.1',
      '1.0.0-beta.11',
      '1.0.0-beta.2',
      '1.0.0-beta',
      '1.0.0-alpha.beta',
      '1.0.0-alpha.1',
      '1.0.0-alpha',
    ]
    expect(order([...newestFirst].reverse())).toEqual(newestFirst)
  })

  it('treats a pre-release identifier containing a dash as part of the tag', () => {
    // Splitting on every '-' rather than the first would read this as '1.0.0'
    // with tag 'alpha', losing the '-1'.
    expect(order(['1.0.0-alpha-1', '1.0.0-alpha-2', '1.0.0'])).toEqual([
      '1.0.0',
      '1.0.0-alpha-2',
      '1.0.0-alpha-1',
    ])
  })
})

describe('sortByVersionDesc — malformed input', () => {
  it('treats a missing component as zero', () => {
    expect(order(['1.2', '1.2.1', '2'])).toEqual(['2', '1.2.1', '1.2'])
  })

  it('ignores build metadata', () => {
    expect(order(['1.0.0+build.9', '1.0.1', '1.0.0-alpha+001'])).toEqual([
      '1.0.1',
      '1.0.0+build.9',
      '1.0.0-alpha+001',
    ])
  })

  it('sinks unparseable versions below every real one, in input order', () => {
    // The previous copies produced NaN here (Number('nightly')), which the sort
    // spec silently coerces to 0 — every junk entry then compared "equal" to
    // every real one and the whole list order became engine-dependent.
    expect(order(['nightly', '0.0.1', 'main', '0.0.0'])).toEqual([
      '0.0.1',
      '0.0.0',
      'nightly',
      'main',
    ])
  })

  it('sinks an empty version string rather than reading it as 0.0.0', () => {
    // Number('') is 0, so the naive parse ranked '' alongside a real 0.0.0.
    expect(order(['', '1.0.0', '0.0.0'])).toEqual(['1.0.0', '0.0.0', ''])
  })
})

describe('compareVersionsDesc is a total order', () => {
  // A comparator that returns NaN, or that is asymmetric or intransitive, makes
  // Array#sort's output implementation-defined. Asserting the contract directly
  // is cheaper than trying to guess which list will expose the violation.
  const cases = [
    '1.0.0',
    'v1.0.0',
    '1.0.0-alpha',
    '1.0.0-alpha.1',
    '1.0.0+b',
    '',
    'x',
    '1.2',
    '2.0.0',
    '0.0.0',
    '1.0.0-rc.1',
    '10.0.0',
    '1.0.0-1',
    '1.0.0-1.2',
  ]

  it('never returns NaN and is antisymmetric', () => {
    const violations: string[] = []
    for (const a of cases) {
      for (const b of cases) {
        const forward = compareVersionsDesc(a, b)
        if (Number.isNaN(forward)) violations.push(`NaN for (${a}, ${b})`)
        if (Math.sign(forward) !== -Math.sign(compareVersionsDesc(b, a))) {
          violations.push(`asymmetric for (${a}, ${b})`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('is transitive, including for versions it considers equal', () => {
    const violations: string[] = []
    for (const a of cases) {
      for (const b of cases) {
        for (const c of cases) {
          const ab = Math.sign(compareVersionsDesc(a, b))
          const bc = Math.sign(compareVersionsDesc(b, c))
          const ac = Math.sign(compareVersionsDesc(a, c))
          if (ab < 0 && bc < 0 && ac >= 0) violations.push(`${a} < ${b} < ${c}`)
          if (ab === 0 && bc === 0 && ac !== 0) violations.push(`${a} = ${b} = ${c}`)
        }
      }
    }
    expect(violations).toEqual([])
  })
})

/**
 * Guard against the two hooks re-growing private copies of this comparator
 * (#673). Deduplicating them is only half the fix — the copies drifted silently
 * once already, and nothing in the type system stops it happening again.
 *
 * Scoped to the two files the issue names rather than sweeping all of src:
 * `?raw` on named files is the mechanism routeScopeParity.test.ts already
 * proves works here. A repo-wide sweep is the thing to add if a third copy
 * ever turns up.
 */
describe('single version comparator (#673)', () => {
  const hooks = [
    { name: 'useModuleDetail.ts', source: moduleHookSource },
    { name: 'useProviderDetail.ts', source: providerHookSource },
  ]

  for (const { name, source } of hooks) {
    it(`${name} is actually loaded and sorts versions`, () => {
      // If a hook were renamed or the ?raw import started resolving to something
      // empty, every assertion below would vacuously pass. An empty universe is
      // the failure mode this guard exists to prevent, so it is asserted first.
      expect(source.length).toBeGreaterThan(500)
      expect(source).toContain('sortByVersionDesc')
    })

    it(`${name} imports the shared helper instead of defining one`, () => {
      expect(source).toMatch(
        /import\s*\{[^}]*sortByVersionDesc[^}]*\}\s*from\s*'\.\.\/utils\/semver'/,
      )
      expect(source).not.toContain('function sortVersionsDesc')
    })

    it(`${name} contains no hand-rolled version parsing`, () => {
      // The fingerprint of the forked helper: strip a leading 'v', then split
      // the pre-release off. Either alone starts a private reimplementation.
      expect(source).not.toContain('/^v/')
      expect(source).not.toContain(".split('-')")
    })
  }
})
