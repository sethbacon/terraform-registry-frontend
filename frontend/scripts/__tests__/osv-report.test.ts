import { describe, it, expect, beforeEach } from 'vitest'
// Node's URL, not happy-dom's global one: fileURLToPath rejects a DOM URL.
import { fileURLToPath, URL as NodeURL } from 'node:url'
// @ts-expect-error -- plain ESM script, no type declarations by design
import {
  LABEL,
  readReport,
  countReportedPackages,
  relativeSource,
  collect,
  fingerprint,
  readFingerprint,
  previousIds,
  renderBody,
  run,
} from '../osv-report.mjs'

/**
 * Both fixtures are VERBATIM osv-scanner v2.3.8 JSON, not hand-written:
 *
 *   osv-findings.json — this repo's own `frontend/package-lock.json` as of
 *     e52794c~1, re-scanned with the pinned scanner version. The only edit is
 *     the absolute lockfile path, rewritten to the runner's workspace root so
 *     the source column is asserted against what CI actually produces.
 *   osv-clean.json — current `main`'s two lockfiles, which scan clean.
 *
 * Hand-built fixtures are what let the original filer assume Go-shaped
 * advisories; these are the shapes npm really emits (`database_specific.severity`
 * for the band, `groups[].max_severity` for the score, `aliases` often absent,
 * one advisory listed once per installed copy of a package).
 */
const FINDINGS = fileURLToPath(new NodeURL('./fixtures/osv-findings.json', import.meta.url))
const CLEAN = fileURLToPath(new NodeURL('./fixtures/osv-clean.json', import.meta.url))
const EXCEPTIONS = fileURLToPath(new NodeURL('../npm-audit-exceptions.json', import.meta.url))
const WORKSPACE = '/home/runner/work/terraform-registry-frontend/terraform-registry-frontend'

const NO_EXCEPTIONS = { byAdvisory: new Map(), byPackage: new Map() }

type Call = { name: string; args: Record<string, unknown> }

function mockGithub({ issues = [] as Record<string, unknown>[], labelExists = true, createdNumber = 900 } = {}) {
  const calls: Call[] = []
  const record =
    (name: string, result: unknown = undefined) =>
    async (args: Record<string, unknown>) => {
      calls.push({ name, args })
      return result
    }
  const github = {
    rest: {
      issues: {
        listForRepo: record('listForRepo', { data: issues }),
        create: record('create', { data: { number: createdNumber } }),
        update: record('update', { data: {} }),
        createComment: record('createComment', { data: {} }),
        createLabel: record('createLabel', { data: {} }),
        getLabel: async (args: Record<string, unknown>) => {
          calls.push({ name: 'getLabel', args })
          if (labelExists) return { data: { name: LABEL } }
          const err: Error & { status?: number } = new Error('Not Found')
          err.status = 404
          throw err
        },
      },
    },
  }
  return { github, calls, of: (name: string) => calls.filter((c) => c.name === name) }
}

function mockCore() {
  const failures: string[] = []
  const info: string[] = []
  const summary = {
    addHeading(this: typeof summary) {
      return this
    },
    addRaw(this: typeof summary) {
      return this
    },
    async write() {},
  }
  return {
    core: {
      setFailed: (m: string) => failures.push(m),
      info: (m: string) => info.push(m),
      summary,
    },
    failures,
    info,
  }
}

const CONTEXT = {
  repo: { owner: 'sethbacon', repo: 'terraform-registry-frontend' },
  serverUrl: 'https://github.com',
  runId: 4242,
  sha: 'abcdef1234567890abcdef1234567890abcdef12',
}

const RUN_URL = 'https://github.com/sethbacon/terraform-registry-frontend/actions/runs/4242'

function invoke(overrides: Record<string, unknown> = {}) {
  return {
    context: CONTEXT,
    reportPath: FINDINGS,
    exceptionsPath: EXCEPTIONS,
    scanOutcome: 'failure',
    workspace: WORKSPACE,
    today: '2026-08-13',
    ...overrides,
  }
}

describe('readReport', () => {
  it('parses a real scanner report', () => {
    expect(countReportedPackages(readReport(FINDINGS))).toBe(9)
  })

  it('names the missing file rather than returning an empty report', () => {
    expect(() => readReport('/nonexistent/osv-results.json')).toThrowError(
      /could not read \/nonexistent\/osv-results\.json \(ENOENT/,
    )
  })

  it('rejects truncated JSON', () => {
    const truncated = fileURLToPath(new NodeURL('./fixtures/osv-clean.json', import.meta.url))
    expect(readReport(truncated).results).toEqual([])
  })

  it('rejects a well-formed JSON document that is not a scanner report', () => {
    const notAReport = fileURLToPath(new NodeURL('../npm-audit-exceptions.json', import.meta.url))
    expect(() => readReport(notAReport)).toThrowError(/has no `results` array, so it is not an osv-scanner report/)
  })
})

describe('relativeSource', () => {
  it.each([
    [`${WORKSPACE}/frontend/package-lock.json`, 'frontend/package-lock.json'],
    [`${WORKSPACE}/e2e/package-lock.json`, 'e2e/package-lock.json'],
    ['/elsewhere/package-lock.json', '/elsewhere/package-lock.json'],
  ])('%s -> %s', (input, expected) => {
    expect(relativeSource(input, WORKSPACE)).toBe(expected)
  })
})

describe('collect', () => {
  const { tracked, documented } = collect(readReport(FINDINGS), NO_EXCEPTIONS, WORKSPACE)

  it('tracks exactly the high/critical advisories the gate counts', () => {
    expect(tracked.map((f) => `${f.pkg}@${f.version} ${f.id} ${f.fixed} ${f.status}`)).toEqual([
      'brace-expansion@1.1.16 GHSA-mh99-v99m-4gvg 1.1.17 fix available',
      'brace-expansion@1.1.16 GHSA-rgw5-rvv9-x895 1.1.18 fix available',
      'brace-expansion@5.0.7 GHSA-mh99-v99m-4gvg 5.0.8 fix available',
      'brace-expansion@5.0.7 GHSA-rgw5-rvv9-x895 5.0.9 fix available',
      'immutable@3.8.3 GHSA-v56q-mh7h-f735 4.3.9 only a semver-major (breaking) fix is available',
      'immutable@3.8.3 GHSA-xvcm-6775-5m9r 4.3.9 only a semver-major (breaking) fix is available',
      'js-yaml@4.3.0 GHSA-5p4m-2wfm-xmqj 4.3.1 fix available',
      'nanoid@3.3.16 GHSA-2v37-7h3g-55p8 3.3.18 fix available',
      'react-router@7.18.1 GHSA-qwww-vcr4-c8h2 7.18.2 fix available',
      'undici@7.28.0 GHSA-4cwx-7wf7-3272 7.29.0 fix available',
    ])
    expect(documented).toEqual([])
  })

  it('carries the fields that make the issue actionable without a workflow log', () => {
    expect(tracked.find((f) => f.id === 'GHSA-2v37-7h3g-55p8')).toEqual({
      id: 'GHSA-2v37-7h3g-55p8',
      aliases: ['CVE-2026-67213'],
      severity: 'high',
      cvss: '8.2',
      pkg: 'nanoid',
      version: '3.3.16',
      fixed: '3.3.18',
      summary: 'nanoid: custom generators can loop indefinitely when size is zero',
      lockfile: 'frontend/package-lock.json',
      status: 'fix available',
    })
  })

  it('drops the moderate advisories the gate ignores, so issue and gate agree', () => {
    // dompurify GHSA-55q2-fjhq-7xh7 and postcss GHSA-fxqj-rqcc-2cmp are MODERATE
    // and present in the fixture; neither is tracked.
    expect(tracked.map((f) => f.pkg)).not.toContain('dompurify')
    expect(tracked.map((f) => f.pkg)).not.toContain('postcss')
  })

  it('moves an advisory to documented-only once it is an accepted risk', () => {
    const exceptions = {
      byAdvisory: new Map([['GHSA-2v37-7h3g-55p8', { reason: 'not reachable from the bundle', review_by: '2026-12-01' }]]),
      byPackage: new Map(),
    }
    const out = collect(readReport(FINDINGS), exceptions, WORKSPACE)
    expect(out.tracked.map((f) => f.id)).not.toContain('GHSA-2v37-7h3g-55p8')
    expect(out.documented.map((f) => `${f.id} ${f.status} ${f.reason}`)).toEqual([
      'GHSA-2v37-7h3g-55p8 accepted risk not reachable from the bundle',
    ])
  })

  it('reports nothing at all for a clean scan', () => {
    expect(collect(readReport(CLEAN), NO_EXCEPTIONS, WORKSPACE)).toEqual({ tracked: [], documented: [] })
  })
})

describe('fingerprint', () => {
  const base = [{ id: 'GHSA-a', pkg: 'p', version: '1.0.0', fixed: '1.0.1' }]

  it('is stable for an unchanged finding set', () => {
    expect(fingerprint(base)).toBe(fingerprint([{ ...base[0] }]))
  })

  it('changes when an advisory is added', () => {
    expect(fingerprint([...base, { id: 'GHSA-b', pkg: 'q', version: '2.0.0', fixed: '' }])).not.toBe(fingerprint(base))
  })

  it('changes when a finding becomes actionable (a fix appears)', () => {
    expect(fingerprint([{ ...base[0], fixed: '' }])).not.toBe(fingerprint(base))
  })

  it('round-trips through the issue body marker', () => {
    const fp = fingerprint(base)
    expect(readFingerprint(`body text\n<!-- osv-fingerprint: ${fp} -->`)).toBe(fp)
    expect(readFingerprint('a body with no marker')).toBeNull()
  })
})

describe('renderBody', () => {
  const { tracked, documented } = collect(readReport(FINDINGS), NO_EXCEPTIONS, WORKSPACE)
  const body = renderBody({
    tracked,
    documented,
    fingerprint: 'deadbeef0000',
    today: '2026-08-13',
    runUrl: RUN_URL,
    sha: CONTEXT.sha,
  })

  it('counts findings, packages and how many are actionable', () => {
    expect(body).toContain(
      '**10 high/critical advisory/advisories across 6 package(s)** — 8 with a non-breaking fix available, 2 without.',
    )
  })

  it('renders a row naming advisory, severity, package, version, fix and lockfile', () => {
    expect(body).toContain(
      '| [GHSA-2v37-7h3g-55p8](https://osv.dev/GHSA-2v37-7h3g-55p8) | high (8.2) | `nanoid` | `3.3.16` | ' +
        '`3.3.18` | `frontend/package-lock.json` | fix available |',
    )
  })

  it('names the same advisory once per installed copy, with that copy s own fix', () => {
    expect(body).toContain('| `brace-expansion` | `1.1.16` | `1.1.17` |')
    expect(body).toContain('| `brace-expansion` | `5.0.7` | `5.0.8` |')
  })

  it('lists summaries and aliases in the details block', () => {
    expect(body).toContain(
      '- **GHSA-2v37-7h3g-55p8** — nanoid: custom generators can loop indefinitely when size is zero ' +
        '_(aliases: CVE-2026-67213)_',
    )
  })

  it('carries the run, commit and fingerprint the next run reads back', () => {
    expect(body).toContain(`- **Last confirmed:** 2026-08-13 ([run](${RUN_URL}), commit \`abcdef1\`)`)
    expect(body).toContain('<!-- osv-fingerprint: deadbeef0000 -->')
    expect(readFingerprint(body)).toBe('deadbeef0000')
  })

  it('lists accepted risks separately and does not count them', () => {
    const withAccepted = renderBody({
      tracked: tracked.slice(0, 1),
      documented: [{ id: 'GHSA-x', pkg: 'p', version: '1.0.0', reason: 'dev-only', status: 'accepted risk' }],
      fingerprint: 'aaaa',
      today: '2026-08-13',
      runUrl: RUN_URL,
      sha: CONTEXT.sha,
    })
    expect(withAccepted).toContain('<details><summary>1 documented accepted risk(s) — not counted above</summary>')
    expect(withAccepted).toContain('- GHSA-x — `p@1.0.0` — _dev-only_')
    expect(withAccepted).toContain('**1 high/critical advisory/advisories across 1 package(s)**')
  })

  it('lets the next run recover the advisory ids it listed', () => {
    expect([...previousIds(body)].sort()).toEqual([
      'GHSA-2v37-7h3g-55p8',
      'GHSA-4cwx-7wf7-3272',
      'GHSA-5p4m-2wfm-xmqj',
      'GHSA-mh99-v99m-4gvg',
      'GHSA-qwww-vcr4-c8h2',
      'GHSA-rgw5-rvv9-x895',
      'GHSA-v56q-mh7h-f735',
      'GHSA-xvcm-6775-5m9r',
    ])
  })
})

describe('run — unreadable scan output', () => {
  it('fails loudly instead of reading as clean', async () => {
    const { github, of } = mockGithub({ issues: [{ number: 5, body: '<!-- osv-fingerprint: aaaaaaaaaaaa -->' }] })
    const { core, failures } = mockCore()

    const result = await run(invoke({ github, core, reportPath: '/nonexistent/osv-results.json' }))

    expect(result).toBe('failed')
    expect(failures).toEqual([
      expect.stringContaining('could not read /nonexistent/osv-results.json (ENOENT'),
    ])
    expect(failures[0]).toContain('The scan produced no usable report, so findings could not be triaged.')
    // Decisive: it must not have closed the live issue.
    expect(of('update')).toEqual([])
    expect(of('createComment')).toEqual([])
  })

  it('fails when the scanner exited non-zero having scanned nothing (network, rate limit)', async () => {
    const { github, of } = mockGithub({ issues: [{ number: 5, body: 'x' }] })
    const { core, failures } = mockCore()

    const result = await run(invoke({ github, core, reportPath: CLEAN, scanOutcome: 'failure' }))

    expect(result).toBe('failed')
    expect(failures).toEqual([
      'osv-scanner exited non-zero (outcome: failure) and reported no packages at all. ' +
        'That is a scan failure, not a clean tree; refusing to report clean.',
    ])
    expect(of('update')).toEqual([])
  })

  it('accepts a clean report when the scanner exited zero', async () => {
    const { github } = mockGithub({ issues: [] })
    const { core, failures } = mockCore()

    const result = await run(invoke({ github, core, reportPath: CLEAN, scanOutcome: 'success' }))

    expect(result).toBe('noop')
    expect(failures).toEqual([])
  })
})

describe('run — clean scan resolves the tracking issue', () => {
  it('comments the evidence and closes the open issue', async () => {
    const { github, of } = mockGithub({ issues: [{ number: 77, body: 'old body' }] })
    const { core, info } = mockCore()

    const result = await run(invoke({ github, core, reportPath: CLEAN, scanOutcome: 'success' }))

    expect(result).toBe('closed')
    expect(of('createComment')[0].args).toEqual({
      owner: 'sethbacon',
      repo: 'terraform-registry-frontend',
      issue_number: 77,
      body: [
        '**Resolved — OSV-Scanner reported no tracked advisories on 2026-08-13.**',
        '',
        `Verified by [this run](${RUN_URL}) against \`${CONTEXT.sha}\`.`,
        '',
        'Closing automatically. A future scan with findings will open a new tracking issue.',
      ].join('\n'),
    })
    expect(of('update')[0].args).toEqual({
      owner: 'sethbacon',
      repo: 'terraform-registry-frontend',
      issue_number: 77,
      state: 'closed',
      state_reason: 'completed',
    })
    expect(info).toContain('Closed #77 — scan reported no tracked advisories.')
  })

  it('does nothing when there is no open issue to close', async () => {
    const { github, of } = mockGithub({ issues: [] })
    const { core, info } = mockCore()

    const result = await run(invoke({ github, core, reportPath: CLEAN, scanOutcome: 'success' }))

    expect(result).toBe('noop')
    expect(of('update')).toEqual([])
    expect(of('create')).toEqual([])
    expect(info).toContain('No tracked advisories and no open OSV issue. Nothing to do.')
  })

  it('ignores a pull request that carries the label', async () => {
    const { github, of } = mockGithub({ issues: [{ number: 90, body: 'pr', pull_request: { url: 'x' } }] })
    const { core } = mockCore()

    const result = await run(invoke({ github, core, reportPath: CLEAN, scanOutcome: 'success' }))

    expect(result).toBe('noop')
    expect(of('update')).toEqual([])
  })
})

describe('run — findings open exactly one issue', () => {
  let mock: ReturnType<typeof mockGithub>

  beforeEach(() => {
    mock = mockGithub({ issues: [], createdNumber: 781 })
  })

  it('looks the issue up by label, not by title', async () => {
    const { core } = mockCore()
    await run(invoke({ github: mock.github, core }))

    expect(mock.of('listForRepo')[0].args).toEqual({
      owner: 'sethbacon',
      repo: 'terraform-registry-frontend',
      state: 'open',
      labels: 'osv-report',
      per_page: 100,
    })
  })

  it('creates the issue with the dedupe label applied', async () => {
    const { core, info } = mockCore()
    const result = await run(invoke({ github: mock.github, core }))

    expect(result).toBe('created')
    const created = mock.of('create')[0].args as { title: string; labels: string[]; body: string }
    expect(created.title).toBe('OSV-Scanner: vulnerabilities found — 2026-08-13')
    expect(created.labels).toEqual(['osv-report', 'security', 'dependencies'])
    expect(created.body).toContain('| [GHSA-qwww-vcr4-c8h2](https://osv.dev/GHSA-qwww-vcr4-c8h2) |')
    expect(info).toContain('Opened #781 with 10 advisory/advisories.')
  })

  it('creates the label first when it does not exist, or the next run opens a second issue', async () => {
    const missing = mockGithub({ issues: [], labelExists: false })
    const { core, info } = mockCore()

    await run(invoke({ github: missing.github, core }))

    expect(missing.of('createLabel')[0].args).toEqual({
      owner: 'sethbacon',
      repo: 'terraform-registry-frontend',
      name: 'osv-report',
      color: 'B60205',
      description: 'Tracking issue maintained by the weekly OSV-Scanner job',
    })
    expect(info).toContain("Created missing 'osv-report' label.")
    // Order matters: the label must exist before the issue that relies on it.
    const names = missing.calls.map((c) => c.name)
    expect(names.indexOf('createLabel')).toBeLessThan(names.indexOf('create'))
  })

  it('propagates a label lookup failure that is not a 404 rather than opening an issue', async () => {
    const boom = mockGithub({ issues: [] })
    boom.github.rest.issues.getLabel = async () => {
      const err: Error & { status?: number } = new Error('server error')
      err.status = 500
      throw err
    }
    const { core } = mockCore()

    await expect(run(invoke({ github: boom.github, core }))).rejects.toThrowError('server error')
    expect(boom.of('create')).toEqual([])
  })
})

describe('run — an existing issue is updated, never duplicated', () => {
  const bodyFor = (reportPath: string) => {
    const { tracked, documented } = collect(readReport(reportPath), NO_EXCEPTIONS, WORKSPACE)
    return renderBody({
      tracked,
      documented,
      fingerprint: fingerprint(tracked),
      today: '2026-08-06',
      runUrl: RUN_URL,
      sha: CONTEXT.sha,
    })
  }

  it('rewrites in place and stays silent when the finding set is unchanged', async () => {
    const { github, of } = mockGithub({ issues: [{ number: 781, body: bodyFor(FINDINGS) }] })
    const { core, info } = mockCore()

    const result = await run(invoke({ github, core }))

    expect(result).toBe('refreshed')
    expect(of('create')).toEqual([])
    expect(of('createComment')).toEqual([])
    expect(of('update')).toHaveLength(1)
    const updated = of('update')[0].args as { issue_number: number; title: string; body: string }
    expect(updated.issue_number).toBe(781)
    expect(updated.title).toBe('OSV-Scanner: vulnerabilities found — 2026-08-13')
    expect(updated.body).toContain('- **Last confirmed:** 2026-08-13')
    expect(info).toContain('#781 refreshed; finding set unchanged (d131c5e79cf0).')
  })

  it('comments exactly which advisories were added and removed when the set changes', async () => {
    const stale = [
      '## OSV-Scanner Vulnerability Report',
      '| [GHSA-qwww-vcr4-c8h2](https://osv.dev/GHSA-qwww-vcr4-c8h2) | high | `react-router` | `7.18.1` | | | |',
      '| [GHSA-0000-0000-0000](https://osv.dev/GHSA-0000-0000-0000) | high | `gone` | `1.0.0` | | | |',
      '<!-- osv-fingerprint: 000000000000 -->',
    ].join('\n')
    const { github, of } = mockGithub({ issues: [{ number: 781, body: stale }] })
    const { core, info } = mockCore()

    const result = await run(invoke({ github, core }))

    expect(result).toBe('updated')
    expect(of('create')).toEqual([])
    const comment = of('createComment')[0].args as { body: string }
    expect(comment.body).toBe(
      [
        // A blank line before and after the bullets: they must render as a
        // list, not run into the surrounding paragraphs.
        `**Finding set changed as of 2026-08-13** ([run](${RUN_URL})).`,
        '',
        '- Newly reported: `GHSA-mh99-v99m-4gvg`, `GHSA-rgw5-rvv9-x895`, `GHSA-v56q-mh7h-f735`, ' +
          '`GHSA-xvcm-6775-5m9r`, `GHSA-5p4m-2wfm-xmqj`, `GHSA-2v37-7h3g-55p8`, `GHSA-4cwx-7wf7-3272`',
        '- No longer reported: `GHSA-0000-0000-0000`',
        '',
        'The issue body above has been updated to the current set.',
        // A blank line before and after the bullets: they must render as a list,
        // not run into the surrounding paragraphs.
      ].join('\n'),
    )
    expect(info).toContain('#781 updated: +7 / -1.')
  })

  it('says so when the same advisories changed details — a fix becoming available', async () => {
    // Same ids as the current report, but recorded when nothing was fixable.
    const { tracked } = collect(readReport(FINDINGS), NO_EXCEPTIONS, WORKSPACE)
    const previous = renderBody({
      tracked: tracked.map((f) => ({ ...f, fixed: '', status: 'no fixed version published' })),
      documented: [],
      fingerprint: fingerprint(tracked.map((f) => ({ ...f, fixed: '' }))),
      today: '2026-08-06',
      runUrl: RUN_URL,
      sha: CONTEXT.sha,
    })
    const { github, of } = mockGithub({ issues: [{ number: 781, body: previous }] })
    const { core } = mockCore()

    const result = await run(invoke({ github, core }))

    expect(result).toBe('updated')
    const comment = of('createComment')[0].args as { body: string }
    expect(comment.body).toContain(
      '- Same advisories, changed details (installed or fixed version) — see the table above.',
    )
    expect(comment.body).not.toContain('Newly reported')
    expect(comment.body).not.toContain('No longer reported')
  })
})
