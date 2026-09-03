/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import * as facade from '../index'

/**
 * GUARD: the suite facade is the app's ONLY door to
 * `@4cloudguru/cloud-suite-ui`, and it is wide enough for everyone who uses it
 * (#603).
 *
 * # What it is guarding against
 *
 * Two failures, and they pull in opposite directions:
 *
 *   1. THE FACADE NARROWS. Someone tidies `src/suite/index.ts` and drops a
 *      re-export the app still imports. `tsc` catches this for type-only
 *      exports, but a value that disappears from a facade is worth failing on
 *      here too, loudly and by name, rather than in whichever page happens to
 *      render first.
 *   2. THE APP ROUTES AROUND IT. A new file imports the package directly. That
 *      is how the surface got to fourteen modules the first time; nothing about
 *      adding a facade stops it recurring, only a check does. This is the more
 *      valuable of the two assertions.
 *
 * # Why the assertions are derived, not listed
 *
 * A hand-written list of expected exports is a second inventory to forget to
 * update — the exact failure mode #603 documents for ARCHITECTURE.md's tables.
 * Both checks read the imports the app actually writes.
 *
 * # Deliberate scope: tests are exempt from the single-door rule
 *
 * `utils/__tests__/externalUrl.test.ts` mocks the package with
 * `vi.mock('@4cloudguru/cloud-suite-ui', ...)`, which cannot be expressed
 * through the facade — the module id being replaced is the package's. The mock
 * still reaches code that imports via the facade, because the facade's own
 * import resolves to the mocked module, which is precisely the substitutability
 * the facade was asked to provide. Tests are excluded here for that reason, not
 * for convenience.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '..', '..')
const FACADE = path.join(SRC, 'suite', 'index.ts')

const PACKAGE = '@4cloudguru/cloud-suite-ui'

/** `../suite`, `../../suite`, `@/suite` — any spelling of this app's facade. */
const FACADE_SPECIFIER = /^(?:@\/|(?:\.\.?\/)+)suite$/

/** A brace-form `import`/`export ... from '<specifier>'`, type-only or not. */
const BINDING_STATEMENT =
  /(?:^|\n)[ \t]*(?:import|export)[ \t]+(type[ \t]+)?(\{[\s\S]*?\})[ \t]*from[ \t]*['"]([^'"]+)['"]/g

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

const FILES = sourceFiles(SRC).map((file) => ({
  file,
  relative: path.relative(SRC, file),
  source: readFileSync(file, 'utf8'),
}))

/**
 * The VALUE bindings a file takes from the facade. Type-only bindings are
 * dropped — `import type` erases, so there is no runtime export to look for and
 * asserting on one would fail for a facade that is perfectly correct.
 */
function facadeValueImports(source: string): string[] {
  const names: string[] = []
  for (const [, typeOnly, braces, specifier] of source.matchAll(BINDING_STATEMENT)) {
    if (typeOnly || !FACADE_SPECIFIER.test(specifier)) continue
    for (const entry of braces.replace(/[{}]/g, '').split(',')) {
      const binding = entry.trim()
      if (!binding || /^type\s/.test(binding)) continue
      names.push(binding.split(/\s+as\s+/)[0].trim())
    }
  }
  return names
}

/** Every value symbol the app imports through the facade, with its importer. */
function requiredExports(): [string, string][] {
  const pairs: [string, string][] = []
  for (const { relative, source } of FILES) {
    for (const name of facadeValueImports(source)) pairs.push([name, relative])
  }
  return pairs.sort()
}

function importsPackageDirectly(source: string): boolean {
  return new RegExp(`(?:^|\\n)\\s*(?:import|export)[^;]*?from\\s*['"]${PACKAGE}['"]`).test(source)
}

describe('suite facade (#603)', () => {
  it('scanned a real source tree', () => {
    // Positive control. A rotted glob makes every assertion below pass over an
    // empty set, and a blind guard looks exactly like a clean one.
    expect(FILES.length).toBeGreaterThan(100)
    expect(FILES.some(({ relative }) => relative === path.join('suite', 'index.ts'))).toBe(true)
  })

  it('finds app code importing through the facade', () => {
    // Second positive control, for the extractor rather than the walk: if
    // FACADE_SPECIFIER or BINDING_STATEMENT stops matching, requiredExports()
    // empties out and the re-export check below certifies nothing.
    const importers = new Set(requiredExports().map(([, importer]) => importer))
    expect(importers.size).toBeGreaterThan(5)
  })

  it.each(requiredExports())('re-exports %s, imported by %s', (name) => {
    expect(Object.keys(facade)).toContain(name)
  })

  it('is the only module that imports the package directly', () => {
    const direct = FILES.filter(({ source }) => importsPackageDirectly(source)).map(
      ({ file }) => file,
    )
    expect(direct).toEqual([FACADE])
  })

  it('recognises the facade specifier in every spelling the app uses', () => {
    expect(facadeValueImports(`import { Page, type PageProps } from '../suite'`)).toEqual(['Page'])
    expect(facadeValueImports(`import { NavItem } from './suite'`)).toEqual(['NavItem'])
    expect(facadeValueImports(`import { isSafeUrl } from '@/suite'`)).toEqual(['isSafeUrl'])
    expect(facadeValueImports(`export { Page as default } from '../../suite'`)).toEqual(['Page'])
    expect(facadeValueImports(`import type { NavItem } from '../suite'`)).toEqual([])
    expect(facadeValueImports(`import { useSuite } from '../hooks/useSuite'`)).toEqual([])
  })
})
