/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * GUARD: the E2E suite's wait budget lives in playwright.config.ts, not in the
 * specs (#883).
 *
 * # What it is guarding against
 *
 * An explicit per-call `timeout` beats the project's `expect.timeout`
 * unconditionally. #876 raised firefox and webkit to 15 s to fix exactly the
 * flakiness this repository kept hitting, and it changed nothing, because all
 * 119 ordinary waits in the specs carried their own `timeout: 10_000` and won.
 * One slow Firefox card render then failed the `v2.27.0` tag run, and because
 * release.yml gates its docker publish on that job, the 2.27.0 image did not
 * publish while its GitHub release already had.
 *
 * The repair is not a number. It is that a wait does not state its own budget
 * unless it genuinely needs more than its project gets, so raising a browser's
 * budget in one place actually reaches the suite.
 *
 * # Why the assertion is here and shaped like this
 *
 * Nothing else can see it. `tsc` type-checks the specs and a hard-coded timeout
 * is perfectly well typed; eslint runs from `frontend/` and does not cover
 * `e2e/` at all; and the Playwright suite itself is release-gated, so a
 * regression would surface as a red tag run — which is the failure this issue
 * exists to stop. A cheap text check in the always-run unit suite is the only
 * place the rule can be enforced before it costs a release.
 *
 * Text, not AST: the property is "no spec states this number", which survives
 * reformatting far better than a parse of Playwright's option objects would.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url))
const E2E = path.resolve(HERE, '..', '..', '..', 'e2e')
const SPEC_DIRS = [path.join(E2E, 'tests'), path.join(E2E, 'fixtures')]

type SourceFile = { name: string; text: string }

function specSources(): SourceFile[] {
  const files: SourceFile[] = []
  for (const dir of SPEC_DIRS) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.ts')) continue
      files.push({
        name: path.relative(E2E, path.join(dir, entry.name)),
        text: readFileSync(path.join(dir, entry.name), 'utf8'),
      })
    }
  }
  return files
}

/** `file:line` for every line of every spec matching `pattern`. */
function hits(files: SourceFile[], pattern: RegExp): string[] {
  const found: string[] = []
  for (const file of files) {
    file.text.split('\n').forEach((line, i) => {
      if (pattern.test(line)) found.push(`${file.name}:${i + 1}: ${line.trim()}`)
    })
  }
  return found
}

describe('E2E wait budget is config-owned (#883)', () => {
  const files = specSources()
  const config = readFileSync(path.join(E2E, 'playwright.config.ts'), 'utf8')

  it('finds the spec files at all', () => {
    // An empty universe passes every "there are no bad waits" assertion below
    // while proving nothing, and it is the likeliest way this guard rots: the
    // specs move, this path stops resolving, and the suite goes quietly green.
    // Asserted first, and against a real count rather than > 0.
    expect(files.length).toBeGreaterThanOrEqual(15)
    expect(files.some((f) => f.name.startsWith('tests/'))).toBe(true)
    expect(files.some((f) => f.name.startsWith('fixtures/'))).toBe(true)
  })

  it('states no wait budget at or below the baseline expect.timeout', () => {
    // 10 s is the baseline (chromium) budget in playwright.config.ts, so a
    // wait bounded at 10 s or less buys nothing on chromium and costs firefox
    // and webkit the raise they were given. Probes are the exception below.
    const tooTight = hits(files, /timeout: (?:10_000|5_000|3_000|2_000|1_000|1000)\b/).filter(
      // A PROBE asks a yes/no question to steer the test ("is the spinner up
      // yet?") and swallows the rejection. Its short bound is the point: a
      // probe that takes 20 s to answer "no" is a bug, not a fix. Only these
      // two shapes are exempt, and only these two.
      (hit) => !/\.isVisible\(|\.waitFor\(\{ state:/.test(hit),
    )
    expect(tooTight).toEqual([])
  })

  it('uses auto-retrying assertions rather than waitForSelector', () => {
    // waitForSelector is not an assertion, so it never reads `expect.timeout`
    // and cannot be given a per-project budget at all -- every call has to
    // hard-code one, which is how 38 of the 119 arose. `expect(locator).toBe*`
    // reads the project budget by construction.
    expect(hits(files, /waitForSelector\(/)).toEqual([])
  })

  it('gives firefox and webkit a strictly larger budget than the baseline', () => {
    // The whole point of removing the per-call overrides is that this raise now
    // reaches the suite. If someone flattens the projects back to one budget,
    // the specs are left with no protection at all for the slow engines.
    const budgets = [...config.matchAll(/expect: \{ timeout: ([0-9_]+) \}/g)].map((m) =>
      Number(m[1].replace(/_/g, '')),
    )
    // root + firefox + webkit
    expect(budgets).toHaveLength(3)
    const [baseline, ...perProject] = budgets
    expect(baseline).toBeGreaterThanOrEqual(10_000)
    for (const budget of perProject) expect(budget).toBeGreaterThan(baseline)
  })

  it('gives navigation waits a config-owned budget too', () => {
    // `page.waitForURL` and `page.goto` are navigations, not assertions: they
    // read `use.navigationTimeout` and nothing else. Without this key the 32
    // freed `waitForURL` calls would fall back to Playwright's default of 0 --
    // no limit -- and a wrong redirect would report as an unattributable
    // whole-test timeout instead of naming the step that hung.
    expect(config).toMatch(/navigationTimeout: [0-9_]+,/)
  })
})
