// Mutation self-test for the "Breaking-change footers survive the squash" job
// in .github/workflows/pr-checks.yml.
//
// That guard is a shell script embedded in YAML. actionlint checks its syntax,
// zizmor checks the workflow around it, and until this file nothing ever RAN
// it — so a regex edit, a lost `set -euo pipefail`, or a silently renamed job
// would leave the check reporting green over a script that had stopped
// deciding anything. It sits beside audit-gate and contract-check here for the
// same reason those have tests: a gate nobody exercises is a gate nobody can
// tell has broken.
//
// HOW. The `run:` block is EXTRACTED from the committed workflow rather than
// copied into this file. A copy would drift from the thing it claims to prove,
// which is the same defect one level up. `gh` is stubbed with a script that
// prints a fixture commit history, so no network and no repository are
// involved.
//
// The `gh-unavailable` case is the one that pins fail-closed behaviour, and it
// is the only case a lost `set -euo pipefail` fails. Without that line the
// failed `gh api` still creates an empty commits.ndjson through the redirect,
// the loop counts nothing, and the job prints "Breaking-change declarations in
// this PR: 0" and exits 0 — a check that has stopped looking, and
// indistinguishable from a clean pull request. Every other case here runs
// against a `gh` that succeeds, so none of them can see it.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// `new URL(<literal>, import.meta.url)` is not usable here: Vite rewrites that
// exact pattern into an asset URL, which is no longer a file: URL by the time
// it reaches fileURLToPath. Resolving from the module's own directory sidesteps
// the transform and does not depend on the process's working directory.
const HERE = path.dirname(fileURLToPath(import.meta.url))
const WORKFLOW = path.resolve(HERE, '../../../.github/workflows/pr-checks.yml')
const JOB_KEY = 'breaking-change-footers'

/**
 * The dedented body of the first `run: |` block inside job `key`.
 *
 * Throws rather than returning a placeholder: a self-test that cannot find the
 * thing it proves must fail, not pass over nothing.
 */
function extractRunBlock(yaml: string, key: string): string {
  const lines = yaml.split(/\r?\n/)
  const start = lines.findIndex((line) => new RegExp(`^  ${key}:\\s*$`).test(line))
  if (start === -1) {
    throw new Error(
      `no job \`${key}:\` in ${WORKFLOW} — the guard this test exists to prove is gone or renamed, ` +
        'which is a failure and not a pass',
    )
  }

  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {2}[A-Za-z0-9_.-]+:\s*$/.test(lines[i])) {
      end = i
      break
    }
  }

  const body = lines.slice(start, end)
  const runAt = body.findIndex((line) => /^\s+run:\s*\|\s*$/.test(line))
  if (runAt === -1) throw new Error(`job \`${key}\` has no \`run: |\` block`)

  // Indent comes from the first NON-BLANK line of the block. Taking it from
  // `runAt + 1` unconditionally would turn a block that merely opens with a
  // blank line — which is what deleting the `set -euo pipefail` line leaves
  // behind — into "block is empty", and this file would then report that
  // instead of running the cases against the guard it still has.
  let firstBody = runAt + 1
  while (firstBody < body.length && body[firstBody].trim() === '') firstBody += 1
  const indent = /^(\s+)/.exec(body[firstBody] ?? '')
  if (!indent) throw new Error(`job \`${key}\`'s \`run: |\` block is empty`)

  const script: string[] = []
  for (let i = runAt + 1; i < body.length; i++) {
    const line = body[i]
    if (line.trim() === '') {
      script.push('')
      continue
    }
    if (!line.startsWith(indent[1])) break
    script.push(line.slice(indent[1].length))
  }
  return script.join('\n')
}

const guard = extractRunBlock(readFileSync(WORKFLOW, 'utf8'), JOB_KEY)

let workRoot = ''
let scriptPath = ''
/** A `gh` that prints the fixture history. */
let binDir = ''
/** A `gh` that fails the way the real one does on a 403, a revoked token or a rate limit. */
let failingBinDir = ''
let fixtureSeq = 0

beforeAll(() => {
  workRoot = mkdtempSync(path.join(tmpdir(), 'breaking-change-footers-'))
  scriptPath = path.join(workRoot, 'guard.sh')
  writeFileSync(scriptPath, guard)

  binDir = path.join(workRoot, 'bin')
  mkdirSync(binDir)
  writeFileSync(path.join(binDir, 'gh'), '#!/bin/sh\ncat "$FIXTURE_COMMITS"\n', { mode: 0o755 })

  failingBinDir = path.join(workRoot, 'bin-failing')
  mkdirSync(failingBinDir)
  writeFileSync(
    path.join(failingBinDir, 'gh'),
    '#!/bin/sh\necho "gh: HTTP 403: Resource not accessible by integration" >&2\nexit 1\n',
    { mode: 0o755 },
  )
})

afterAll(() => {
  if (workRoot) rmSync(workRoot, { recursive: true, force: true })
})

interface GuardRun {
  status: number | null
  output: string
  summary: string
}

function runGuard(commits: string[], stubDir: string = binDir): GuardRun {
  const dir = path.join(workRoot, `case-${(fixtureSeq += 1)}`)
  mkdirSync(dir)
  const fixture = path.join(dir, 'commits.json')
  writeFileSync(fixture, `${commits.map((c, i) => JSON.stringify({ sha: `abc00${i}`, msg: c })).join('\n')}\n`)
  const summary = path.join(dir, 'summary.md')
  writeFileSync(summary, '')

  const result = spawnSync('bash', [scriptPath], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${stubDir}${path.delimiter}${process.env.PATH}`,
      FIXTURE_COMMITS: fixture,
      GH_TOKEN: 'stub',
      PR_NUMBER: '123',
      REPO: 'sethbacon/terraform-registry-frontend',
      GITHUB_STEP_SUMMARY: summary,
    },
  })

  return {
    status: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    summary: readFileSync(summary, 'utf8'),
  }
}

const FOOTER = 'BREAKING CHANGE: the module detail route moved'

describe('the guard is the one in the workflow', () => {
  it('extracts a real script, not an empty match that would pass every case below', () => {
    expect(guard.split('\n').length).toBeGreaterThan(20)
    expect(guard).toMatch(/BREAKING\[ -\]CHANGE:/)
    expect(guard).toContain('gh api --paginate')
  })
})

describe('pull requests it must not obstruct', () => {
  it('passes a PR with no breaking change at all', () => {
    const { status, output } = runGuard(['fix: keep the version selector in sync with the route'])
    expect(output).toContain('declarations in this PR: 0')
    expect(output).toContain('at most one declaration')
    expect(status).toBe(0)
  })

  it('passes a PR declaring exactly one, which is what the squash can carry', () => {
    const { status, output } = runGuard([`feat: rework the module detail route\n\n${FOOTER}`])
    expect(output).toContain('declarations in this PR: 1')
    expect(status).toBe(0)
  })

  it('passes a many-commit PR that declares nothing', () => {
    const { status, output } = runGuard(['ci: pin an action', 'docs: fix a link', 'test: cover the parser'])
    expect(output).toContain('declarations in this PR: 0')
    expect(status).toBe(0)
  })

  it('counts a `!` header and a footer in ONE commit as ONE declaration, not two', () => {
    // release-please reads the footer; the `!` is the marker FOR it. Counting
    // them additively would fail the most ordinary way to write a breaking
    // change, and a guard that fires on correct usage gets routed around.
    const { status, output } = runGuard([`feat!: rework the module detail route\n\n${FOOTER}`])
    expect(output).toContain('declarations in this PR: 1')
    expect(status).toBe(0)
  })

  it('treats a mid-line mention as prose rather than a footer', () => {
    const { status, output } = runGuard(['docs: explain that a BREAKING CHANGE: footer is kept only once'])
    expect(output).toContain('declarations in this PR: 0')
    expect(status).toBe(0)
  })
})

describe('pull requests whose squash would drop a declaration', () => {
  it('rejects two footers and says which commits they are in', () => {
    // THE case: terraform-registry-backend v4.0.0 published two breaking
    // changes and documented one.
    const { status, output, summary } = runGuard([
      `feat: drop the legacy module route\n\n${FOOTER}`,
      'feat: require an org scope on search\n\nBREAKING CHANGE: unscoped search is gone',
    ])
    expect(status).not.toBe(0)
    expect(output).toContain('declares 2 breaking changes')
    expect(output).toContain('the squash keeps only the first')
    expect(summary).toContain('**2** breaking changes')
    expect(summary).toContain('abc000')
    expect(summary).toContain('abc001')
  })

  it('counts the `!` marker the same way as a footer', () => {
    const { status, output, summary } = runGuard([
      'feat!: drop the legacy module route',
      'fix(search)!: require an org scope',
    ])
    expect(status).not.toBe(0)
    expect(output).toContain('declares 2 breaking changes')
    expect(summary).toContain('drop the legacy module route')
    expect(summary).toContain('require an org scope')
  })

  it('reads `BREAKING-CHANGE:` as the same token the spec allows', () => {
    // A guard blind to the hyphen would be routed around by the first person
    // who writes it that way.
    const { status, output } = runGuard([
      `feat: drop the legacy module route\n\n${FOOTER}`,
      'feat: require an org scope on search\n\nBREAKING-CHANGE: unscoped search is gone',
    ])
    expect(status).not.toBe(0)
    expect(output).toContain('declares 2 breaking changes')
  })

  it('names how many would ship undocumented when there are three', () => {
    const { status, output, summary } = runGuard([
      `feat: a\n\n${FOOTER}`,
      'feat: b\n\nBREAKING CHANGE: b changed',
      'feat: c\n\nBREAKING CHANGE: c changed',
    ])
    expect(status).not.toBe(0)
    expect(output).toContain('declares 3 breaking changes')
    expect(summary).toContain('The other 2 would ship with no changelog entry')
  })
})

describe('the guard has to fail closed, not quiet', () => {
  it('fails when it cannot read the commit list, rather than counting zero', () => {
    // `set -euo pipefail` is the whole of this property, and this is the only
    // case that notices when it goes. Asserting on the message as well as the
    // exit code: a non-zero exit for some unrelated reason would satisfy the
    // status check alone while the guard still reported a clean count.
    const { status, output } = runGuard(['feat: anything at all'], failingBinDir)
    expect(output).not.toContain('declarations in this PR: 0')
    expect(status).not.toBe(0)
  })
})
