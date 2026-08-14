#!/usr/bin/env node
/**
 * osv-report.mjs — turn an osv-scanner JSON report into ONE tracking issue.
 *
 * Ported from terraform-provider-registry's weekly-security.yml (its #108),
 * which fixed the same class of defect there. The mechanism is identical:
 *
 *   - the issue NAMES the advisories (id, severity, package, installed version,
 *     fixed version, summary, aliases) so it is triageable without opening a
 *     workflow log;
 *   - there is exactly ONE tracking issue, found by the `osv-report` LABEL
 *     rather than by title (the title carries a date, so a title lookup opens a
 *     new issue every week);
 *   - an unchanged finding set rewrites the issue in place with no comment
 *     noise; a changed set comments exactly what was added and removed;
 *   - a scan with no findings CLOSES the issue, so a fixed vulnerability does
 *     not leave a permanently open one;
 *   - an unreadable report FAILS the job instead of reading as "clean" and
 *     closing a live issue.
 *
 * Four things are deliberately NOT ported, because this repository is npm and
 * the original is Go:
 *
 *   1. Reachability. osv-scanner's `experimental_analysis` (`called: false`) is
 *      produced by Go call-graph analysis only; npm lockfile scans carry no
 *      such field, so the original's reachability filter would be a branch that
 *      is always true here. Its PURPOSE — "do not open an issue for something
 *      nobody can act on" — is served instead by this repo's existing
 *      actionability triage (audit-gate.mjs), which is what the PR gate and the
 *      weekly gate already use. Reusing that parser rather than writing a second
 *      one is the point: the issue and the gate cannot disagree about an
 *      advisory.
 *   2. Severity. The original prints `group.max_severity`. For npm that is a
 *      bare CVSS score, and after the gate's high/critical filter a qualitative
 *      column alone would be nearly constant, so both are shown: `high (8.2)`.
 *   3. Lockfile. The original never rendered `source` because Go has one
 *      module. Here an advisory in `e2e/package-lock.json` never reaches a user
 *      and one in `frontend/package-lock.json` may, so the lockfile is a column.
 *   4. Fingerprint. The original hashes id@package@version. This one also hashes
 *      the fix target, so an advisory that GAINS a non-breaking fix — the moment
 *      it becomes actionable — notifies instead of being refreshed silently.
 *
 * Consumed by .github/workflows/weekly-security.yml via actions/github-script.
 * Every function below is pure except `run`, which is the only one that touches
 * the API; see __tests__/osv-report.test.ts.
 */

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

import { triageOsv, loadExceptions } from './audit-gate.mjs'

/** Dedupe key for the tracking issue. A title lookup cannot work: titles carry a date. */
export const LABEL = 'osv-report'

const FINGERPRINT_RE = /<!-- osv-fingerprint: ([0-9a-f]+) -->/
const ADVISORY_LINK_RE = /\[((?:GHSA|CVE|GO|OSV|PYSEC|RUSTSEC)-[0-9A-Za-z-]+)\]\(https:\/\/osv\.dev\//g

/**
 * Reads the scanner's JSON report, refusing anything that is not recognisably
 * one. A missing, truncated or empty file means the scan died before writing
 * output; treating that as "no findings" would close a live tracking issue.
 *
 * @throws {Error} with a message naming the exact reason, which `run` surfaces
 *   through `core.setFailed`.
 */
export function readReport(path) {
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch (err) {
    throw new Error(`could not read ${path} (${err.message})`, { cause: err })
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`could not parse ${path} as JSON (${err.message})`, { cause: err })
  }
  if (!parsed || !Array.isArray(parsed.results)) {
    throw new Error(`${path} has no \`results\` array, so it is not an osv-scanner report`)
  }
  return parsed
}

/** Number of scanned packages carrying at least one advisory, across all lockfiles. */
export function countReportedPackages(report) {
  let n = 0
  for (const result of report?.results ?? []) n += (result?.packages ?? []).length
  return n
}

/** `/home/runner/work/repo/repo/frontend/package-lock.json` -> `frontend/package-lock.json`. */
export function relativeSource(source, workspace) {
  const path = String(source ?? '')
  if (workspace && path.startsWith(`${workspace}/`)) return path.slice(workspace.length + 1)
  return path
}

/**
 * Splits the scanner report into what the issue tracks and what it only
 * mentions.
 *
 *   tracked    — blocking + advisory: real high/critical findings nobody has
 *                signed off on. These keep the issue open.
 *   documented — accepted: listed in npm-audit-exceptions.json with a rationale
 *                and a review date. Someone already decided about these, so
 *                they are context and never keep an issue open on their own —
 *                the same role the original's unreachable findings played.
 */
export function collect(report, exceptions, workspace) {
  const { blocking, advisory, accepted } = triageOsv(report, exceptions)

  const toRow = (entry, status) => ({
    id: entry.advisories?.[0] ?? '(unknown)',
    aliases: (entry.advisories ?? []).slice(1),
    severity: entry.severity ?? '—',
    cvss: entry.cvss ?? '',
    pkg: entry.package ?? '(unknown)',
    version: entry.installed ?? '(unknown)',
    fixed: entry.fix && typeof entry.fix === 'object' ? entry.fix.version : '',
    summary: (entry.titles?.[0] ?? '').trim(),
    lockfile: relativeSource(entry.source, workspace),
    status,
  })

  const byPkgThenId = (a, b) => `${a.pkg}${a.version}${a.id}`.localeCompare(`${b.pkg}${b.version}${b.id}`)
  const tracked = [
    ...blocking.map((e) => toRow(e, 'fix available')),
    ...advisory.map((e) => toRow(e, e.why ?? 'not actionable')),
  ].sort(byPkgThenId)
  const documented = accepted.map((e) => ({ ...toRow(e, 'accepted risk'), reason: e.reason ?? '' })).sort(byPkgThenId)

  return { tracked, documented }
}

/**
 * Stable across runs; changes only when the finding set itself does, so a
 * persisting set updates the issue quietly instead of commenting every Monday.
 * The fix target is part of the key on purpose: an advisory that gains a
 * non-breaking fix has become actionable and is worth a notification.
 */
export function fingerprint(tracked) {
  return createHash('sha256')
    .update(tracked.map((f) => `${f.id}@${f.pkg}@${f.version}@${f.fixed}`).join(';'))
    .digest('hex')
    .slice(0, 12)
}

export function readFingerprint(body) {
  return (body ?? '').match(FINGERPRINT_RE)?.[1] ?? null
}

/** Advisory ids the previous issue body listed, read back out of its table links. */
export function previousIds(body) {
  return new Set([...(body ?? '').matchAll(ADVISORY_LINK_RE)].map((m) => m[1]))
}

export function renderBody({ tracked, documented, fingerprint: fp, today, runUrl, sha }) {
  const severityCell = (f) => (f.cvss ? `${f.severity} (${f.cvss})` : f.severity)
  const table = [
    '| Advisory | Severity | Package | Version | Fixed in | Lockfile | Status |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...tracked.map(
      (f) =>
        `| [${f.id}](https://osv.dev/${f.id}) | ${severityCell(f)} | \`${f.pkg}\` | \`${f.version}\` | ` +
        `${f.fixed ? `\`${f.fixed}\`` : '—'} | \`${f.lockfile}\` | ${f.status} |`,
    ),
  ]

  const details = tracked
    .filter((f) => f.summary || f.aliases.length)
    .map((f) => {
      const alias = f.aliases.length ? ` _(aliases: ${f.aliases.join(', ')})_` : ''
      return `- **${f.id}** — ${f.summary || 'no summary published'}${alias}`
    })

  const fixable = tracked.filter((f) => f.status === 'fix available').length
  const pkgCount = new Set(tracked.map((f) => f.pkg)).size

  return [
    '## OSV-Scanner Vulnerability Report',
    '',
    `**${tracked.length} high/critical advisory/advisories across ${pkgCount} package(s)** — ` +
      `${fixable} with a non-breaking fix available, ${tracked.length - fixable} without.`,
    '',
    `- **Last confirmed:** ${today} ([run](${runUrl}), commit \`${String(sha ?? '').slice(0, 7)}\`)`,
    '',
    ...table,
    '',
    ...(details.length ? ['<details><summary>Advisory details</summary>', '', ...details, '', '</details>', ''] : []),
    ...(documented.length
      ? [
          `<details><summary>${documented.length} documented accepted risk(s) — not counted above</summary>`,
          '',
          ...documented.map(
            (f) => `- ${f.id} — \`${f.pkg}@${f.version}\`${f.reason ? ` — _${f.reason}_` : ''}`,
          ),
          '',
          '</details>',
          '',
        ]
      : []),
    'Rows marked **fix available** have a non-breaking upgrade and also fail the weekly job\'s triage gate ' +
      '(`frontend/scripts/audit-gate.mjs`); upgrade those. The rest have no fix, or only a breaking one — either ' +
      'wait for upstream or record the decision in `frontend/scripts/npm-audit-exceptions.json` with a rationale ' +
      'and a review date, which moves them out of this list.',
    '',
    'This issue is maintained automatically by the weekly scan: rewritten in place while these findings persist, ' +
      'and closed once a scan reports none.',
    '',
    `<!-- osv-fingerprint: ${fp} -->`,
  ].join('\n')
}

/**
 * @returns {'failed'|'closed'|'noop'|'created'|'refreshed'|'updated'} what the
 *   run did — asserted exactly by the tests.
 */
export async function run({
  github,
  context,
  core,
  reportPath = 'osv-results.json',
  exceptionsPath = 'frontend/scripts/npm-audit-exceptions.json',
  scanOutcome = process.env.OSV_SCAN_OUTCOME ?? '',
  workspace = process.env.GITHUB_WORKSPACE ?? '',
  today = new Date().toISOString().slice(0, 10),
}) {
  const repo = { owner: context.repo.owner, repo: context.repo.repo }
  const runUrl = `${context.serverUrl}/${repo.owner}/${repo.repo}/actions/runs/${context.runId}`

  let report
  try {
    report = readReport(reportPath)
  } catch (err) {
    core.setFailed(`${err.message}. The scan produced no usable report, so findings could not be triaged.`)
    return 'failed'
  }

  // osv-scanner exits 0 clean, 1 when it found something, and 127/128 when it
  // could not scan at all (missing lockfile, network, rate limit) — in which
  // case it writes an empty report. Non-zero WITH findings is explained; non-zero
  // WITHOUT any is a scan that did not happen, and must not read as "clean".
  if (scanOutcome !== 'success' && countReportedPackages(report) === 0) {
    core.setFailed(
      `osv-scanner exited non-zero (outcome: ${scanOutcome || 'unknown'}) and reported no packages at all. ` +
        'That is a scan failure, not a clean tree; refusing to report clean.',
    )
    return 'failed'
  }

  const { tracked, documented } = collect(report, loadExceptions(exceptionsPath), workspace)

  const { data: openIssues } = await github.rest.issues.listForRepo({
    ...repo,
    state: 'open',
    labels: LABEL,
    per_page: 100,
  })
  const existing = openIssues.find((i) => !i.pull_request)

  // ── Nothing tracked: resolve the issue rather than leaving it open forever ──
  if (tracked.length === 0) {
    core.summary.addHeading('OSV-Scanner: no tracked advisories', 2)
    core.summary.addRaw(
      `No high/critical advisories outside the accepted-risk register. ${documented.length} accepted risk(s).`,
    )
    await core.summary.write()

    if (!existing) {
      core.info('No tracked advisories and no open OSV issue. Nothing to do.')
      return 'noop'
    }
    await github.rest.issues.createComment({
      ...repo,
      issue_number: existing.number,
      // Conditional lines are spread in, not filtered out afterwards: a blank
      // line here is a markdown paragraph break and must survive.
      body: [
        `**Resolved — OSV-Scanner reported no tracked advisories on ${today}.**`,
        '',
        `Verified by [this run](${runUrl}) against \`${context.sha}\`.`,
        ...(documented.length
          ? [
              '',
              `${documented.length} advisory/advisories remain but are recorded as accepted risks in ` +
                '`frontend/scripts/npm-audit-exceptions.json`, so they are not tracked here.',
            ]
          : []),
        '',
        'Closing automatically. A future scan with findings will open a new tracking issue.',
      ].join('\n'),
    })
    await github.rest.issues.update({ ...repo, issue_number: existing.number, state: 'closed', state_reason: 'completed' })
    core.info(`Closed #${existing.number} — scan reported no tracked advisories.`)
    return 'closed'
  }

  const fp = fingerprint(tracked)
  const body = renderBody({ tracked, documented, fingerprint: fp, today, runUrl, sha: context.sha })
  const title = `OSV-Scanner: vulnerabilities found — ${today}`

  core.summary.addHeading(`OSV-Scanner: ${tracked.length} tracked advisory/advisories`, 2)
  core.summary.addRaw(body)
  await core.summary.write()

  if (!existing) {
    // The label IS the dedupe key. issues.create silently drops a label that
    // does not exist yet, and the next run would then find nothing and open a
    // second issue — so make sure it exists before relying on it.
    try {
      await github.rest.issues.getLabel({ ...repo, name: LABEL })
    } catch (err) {
      if (err.status !== 404) throw err
      await github.rest.issues.createLabel({
        ...repo,
        name: LABEL,
        color: 'B60205',
        description: 'Tracking issue maintained by the weekly OSV-Scanner job',
      })
      core.info(`Created missing '${LABEL}' label.`)
    }

    const { data: created } = await github.rest.issues.create({
      ...repo,
      title,
      body,
      labels: [LABEL, 'security', 'dependencies'],
    })
    core.info(`Opened #${created.number} with ${tracked.length} advisory/advisories.`)
    return 'created'
  }

  const unchanged = readFingerprint(existing.body) === fp
  await github.rest.issues.update({ ...repo, issue_number: existing.number, title, body })

  if (unchanged) {
    core.info(`#${existing.number} refreshed; finding set unchanged (${fp}).`)
    return 'refreshed'
  }

  const before = previousIds(existing.body)
  const now = new Set(tracked.map((f) => f.id))
  const added = [...now].filter((id) => !before.has(id))
  const removed = [...before].filter((id) => !now.has(id))

  await github.rest.issues.createComment({
    ...repo,
    issue_number: existing.number,
    body: [
      `**Finding set changed as of ${today}** ([run](${runUrl})).`,
      '',
      ...(added.length ? [`- Newly reported: ${added.map((id) => `\`${id}\``).join(', ')}`] : []),
      ...(removed.length ? [`- No longer reported: ${removed.map((id) => `\`${id}\``).join(', ')}`] : []),
      // Same ids, different details — most often an advisory that just gained a
      // non-breaking fix, i.e. became actionable.
      ...(!added.length && !removed.length
        ? ['- Same advisories, changed details (installed or fixed version) — see the table above.']
        : []),
      '',
      'The issue body above has been updated to the current set.',
    ].join('\n'),
  })
  core.info(`#${existing.number} updated: +${added.length} / -${removed.length}.`)
  return 'updated'
}
