import { describe, it, expect } from 'vitest'
// ARCHITECTURE.md sits at the repo root, one level above this Vite project, so
// vitest.config.ts extends server.fs.allow to reach it. Imported rather than
// read through node:fs because tsconfig.json covers src/ without node types,
// and pulling them in for one doc check would widen what the whole app may
// call.
import architecture from '../../../ARCHITECTURE.md?raw'

/**
 * ARCHITECTURE.md's two suite-package tables have to name every local file that
 * imports from `@4cloudguru/cloud-suite-ui` (#603).
 *
 * The tables were written by hand and then six files started importing from the
 * package without being added, which is the normal fate of a hand-maintained
 * inventory. Rewriting them once fixes today; deriving the check from the
 * imports themselves is what stops it recurring.
 *
 * A grep for the package NAME would not do: `routeScopes.ts` and
 * `services/errorReporting.ts` mention it in prose comments while importing
 * nothing from it, and counting those would demand rows for files that belong
 * in neither table. The match is on an import statement.
 *
 * The check is one-directional on purpose. It fails when an importer is
 * undocumented; it does not fail when a documented file stops importing,
 * because both tables carry explanatory rows and prose that are worth keeping
 * even so. Deletion is the cheaper error to notice by reading.
 */

const sources = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const PACKAGE = '@4cloudguru/cloud-suite-ui'

/** True only for a real import statement, not a mention in a comment. */
function importsPackage(source: string): boolean {
  return new RegExp(`(?:^|\\n)\\s*import[^;]*?from\\s*['"]${PACKAGE}['"]`).test(source)
}

function importers(): string[] {
  return Object.entries(sources)
    .filter(([path]) => !path.includes('__tests__') && !path.includes('.test.'))
    .filter(([, source]) => importsPackage(source))
    .map(([path]) => path.replace(/^\.\.\//, ''))
    .sort()
}

describe('ARCHITECTURE.md documents every suite-package importer (#603)', () => {
  it('finds importers to check', () => {
    // Positive control: a rotted glob or regex finds nothing, and every
    // assertion below passes over an empty set — a clean tree and a blind
    // check produce the same green.
    expect(importers().length).toBeGreaterThan(5)
  })

  it.each(importers())('%s appears in ARCHITECTURE.md', (file) => {
    expect(architecture).toContain(file)
  })

  it('does not count a file that only names the package in a comment', () => {
    expect(importsPackage(`// see ${PACKAGE} for the contract\nexport const x = 1`)).toBe(false)
    expect(importsPackage(`import { isSafeUrl } from '${PACKAGE}'`)).toBe(true)
  })
})
