import { describe, it, expect } from 'vitest'
// ARCHITECTURE.md sits at the repo root, one level above this Vite project, so
// vitest.config.ts extends server.fs.allow to reach it. Imported rather than
// read through node:fs because tsconfig.json covers src/ without node types,
// and pulling them in for one doc check would widen what the whole app may
// call.
import architecture from '../../../ARCHITECTURE.md?raw'

/**
 * ARCHITECTURE.md's two suite-package tables have to name every local file that
 * depends on `@4cloudguru/cloud-suite-ui` (#603).
 *
 * The tables were written by hand and then six files started importing from the
 * package without being added, which is the normal fate of a hand-maintained
 * inventory. Rewriting them once fixes today; deriving the check from the
 * imports themselves is what stops it recurring.
 *
 * Since the facade landed, "depends on the package" means importing `src/suite`
 * — the facade is now the only module that names the package, and a check that
 * looked for the package alone would document one file and go quiet about the
 * fourteen the tables exist for. The facade itself counts too: it is the row
 * every other row points at.
 *
 * The statement match now covers `export ... from` as well as `import ... from`.
 * It did not before, and the four pure re-export modules
 * (`Page`/`PageHeader`/`DashboardCard`/`ConsentBanner`), which use the export
 * form exclusively, were therefore never checked at all — the importer count
 * this file asserts on was 13 where it should have been 17. They happened to be
 * documented; the check was simply blind to them.
 *
 * A grep for the package NAME would not do either: `routeScopes.ts` and
 * `services/errorReporting.ts` mention it in prose comments while importing
 * nothing from it, and counting those would demand rows for files that belong
 * in neither table. The match is on an import statement.
 *
 * The check is one-directional on purpose. It fails when an importer is
 * undocumented; it does not fail when a documented file stops importing,
 * because both tables carry explanatory rows and prose that are worth keeping
 * even so. Deletion is the cheaper error to notice by reading.
 *
 * Sibling guard: `suite/__tests__/suiteFacade.test.ts` enforces that the facade
 * is the only direct importer of the package, and that it re-exports what the
 * app takes from it.
 */

const sources = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const PACKAGE = '@4cloudguru/cloud-suite-ui'

/** `../suite`, `../../suite`, `@/suite` — any spelling of this app's facade. */
const FACADE = String.raw`(?:@\/|(?:\.\.?\/)+)suite`

/** True only for a real import statement, not a mention in a comment. */
function importsSuite(source: string): boolean {
  return new RegExp(
    `(?:^|\\n)\\s*(?:import|export)[^;]*?from\\s*['"](?:${PACKAGE}|${FACADE})['"]`,
  ).test(source)
}

function importers(): string[] {
  return Object.entries(sources)
    .filter(([path]) => !path.includes('__tests__') && !path.includes('.test.'))
    .filter(([, source]) => importsSuite(source))
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
    expect(importsSuite(`// see ${PACKAGE} for the contract\nexport const x = 1`)).toBe(false)
    expect(importsSuite(`import { isSafeUrl } from '${PACKAGE}'`)).toBe(true)
    expect(importsSuite(`import { isSafeUrl } from '../suite'`)).toBe(true)
    expect(importsSuite(`import { useSuite } from '../hooks/useSuite'`)).toBe(false)
  })
})
