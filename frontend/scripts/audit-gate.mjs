#!/usr/bin/env node
/**
 * audit-gate.mjs — decide whether `npm audit` findings should fail the build.
 *
 * `npm audit --audit-level=high` exits non-zero for ANY advisory at or above
 * the level, including ones nobody can act on right now. Gating merges (or the
 * image build) on those pins the check red regardless of what changed — the
 * only remedy is to wait for upstream — and a permanently-red required check is
 * one everybody learns to ignore.
 *
 * Findings are split three ways:
 *
 *   - blocking  — reaches production AND has a non-breaking fix available.
 *                 Upgrade the dependency; this FAILS the run.
 *   - advisory  — real, but not actionable here: dev-only (never shipped), or
 *                 the only published fix is a semver-major/breaking change.
 *   - accepted  — listed in npm-audit-exceptions.json with a rationale and a
 *                 review date. Reported, never blocking.
 *
 * Written in Node (not Python) on purpose: this same gate runs inside the
 * frontend Dockerfile's node:alpine builder stage, which has no python3.
 *
 * Handles BOTH report formats, auto-detected from the JSON shape:
 *   - `npm audit --json`      (a `vulnerabilities` object)
 *   - `osv-scanner --format json` (a `results` array)
 *
 * One gate and one exceptions file for both scanners is deliberate: they
 * disagree about the same advisory otherwise. OSV lists react-router's fix as
 * 8.3.0 — technically "a fix exists", but a semver-major that also breaks the
 * @sethbacon/terraform-suite-ui pin — so a naive fixed-version-exists rule
 * would block forever on it while npm audit correctly reports it as breaking.
 *
 * Usage:
 *   npm audit --json > audit.json || true
 *   osv-scanner --format json --output osv.json ... || true
 *   node scripts/audit-gate.mjs <report.json> [--exceptions scripts/npm-audit-exceptions.json]
 *
 * Exit codes: 0 = nothing blocking, 1 = blocking findings (or unreadable report).
 */

import { readFileSync, existsSync, appendFileSync } from 'node:fs'

const BLOCKING_SEVERITIES = new Set(['critical', 'high'])

export function loadExceptions(path) {
  if (!path || !existsSync(path)) return { byAdvisory: new Map(), byPackage: new Map() }
  const data = JSON.parse(readFileSync(path, 'utf8'))
  const byAdvisory = new Map()
  const byPackage = new Map()
  for (const entry of data.exceptions ?? []) {
    for (const id of entry.advisories ?? []) byAdvisory.set(id, entry)
    // Package fallback is necessary: npm reports transitively affected packages
    // with a `via` that is just the parent package's *name* (a string, not an
    // advisory object), so those rows carry no advisory id to match on — e.g.
    // react-router-dom inherits react-router's advisory.
    for (const pkg of entry.packages ?? []) byPackage.set(pkg, entry)
  }
  return { byAdvisory, byPackage }
}

function advisoryKeys(via) {
  const keys = []
  for (const item of via ?? []) {
    if (item && typeof item === 'object') {
      if (item.url) keys.push(String(item.url).split('/').pop())
      if (item.source != null) keys.push(String(item.source))
    }
  }
  return keys
}

// Normalises an osv-scanner JSON report into the same entry shape the npm
// triage produces, so downstream reporting and exception handling are shared.
//
// OSV has no dev/prod distinction and no semver-major flag, so severity of the
// *upgrade* is inferred: a fix whose major version differs from the installed
// major is treated as breaking, matching how npm audit labels it. That keeps
// the two scanners from reaching opposite conclusions on one advisory.
export function triageOsv(report, exceptions = { byAdvisory: new Map(), byPackage: new Map() }) {
  const blocking = []
  const advisory = []
  const accepted = []

  const major = (v) => {
    const m = /^\D*(\d+)/.exec(String(v ?? ''))
    return m ? Number(m[1]) : null
  }

  for (const result of report?.results ?? []) {
    const source = result?.source?.path ?? '?'
    for (const pkg of result?.packages ?? []) {
      const name = pkg?.package?.name ?? '?'
      const installed = pkg?.package?.version ?? '?'
      for (const vuln of pkg?.vulnerabilities ?? []) {
        const severity = (vuln?.database_specific?.severity ?? 'HIGH').toLowerCase()
        if (!BLOCKING_SEVERITIES.has(severity)) continue

        // Collect fixed versions this advisory publishes for THIS package.
        const fixed = []
        for (const affected of vuln?.affected ?? []) {
          if (affected?.package?.name && affected.package.name !== name) continue
          for (const range of affected?.ranges ?? []) {
            for (const event of range?.events ?? []) {
              if (event?.fixed) fixed.push(event.fixed)
            }
          }
        }

        const ids = [vuln?.id, ...(vuln?.aliases ?? [])].filter(Boolean)
        const target = fixed[0]
        const breaking =
          target != null && major(target) != null && major(installed) != null && major(target) !== major(installed)

        const entry = {
          package: name,
          severity,
          advisories: ids,
          titles: [vuln?.summary ?? ''],
          devOnly: false,
          source,
          fix: target ? { name, version: target, isSemVerMajor: breaking } : false,
        }

        const hit = ids.map((k) => exceptions.byAdvisory.get(k)).find(Boolean) ?? exceptions.byPackage.get(name)
        if (hit) {
          accepted.push({ ...entry, reason: hit.reason ?? '', reviewBy: hit.review_by ?? '' })
        } else if (!target) {
          advisory.push({ ...entry, why: 'no fixed version published' })
        } else if (breaking) {
          advisory.push({ ...entry, why: 'only a semver-major (breaking) fix is available' })
        } else {
          blocking.push(entry)
        }
      }
    }
  }
  return { blocking, advisory, accepted }
}

// Dispatches on report shape so callers need not say which scanner produced it.
export function triageReport(report, exceptions) {
  if (report && Array.isArray(report.results)) return triageOsv(report, exceptions)
  return triage(report, exceptions)
}

export function triage(report, exceptions = { byAdvisory: new Map(), byPackage: new Map() }) {
  const blocking = []
  const advisory = []
  const accepted = []
  for (const [name, v] of Object.entries(report?.vulnerabilities ?? {})) {
    if (!BLOCKING_SEVERITIES.has(v.severity)) continue
    const via = v.via ?? []
    const keys = advisoryKeys(via)
    const titles = via.filter((i) => i && typeof i === 'object').map((i) => i.title ?? '')
    const fix = v.fixAvailable
    const hasFix = Boolean(fix)
    const breaking = typeof fix === 'object' && fix !== null && fix.isSemVerMajor === true
    const entry = {
      package: name,
      severity: v.severity,
      advisories: keys,
      titles,
      devOnly: Boolean(v.dev),
      fix: typeof fix === 'object' && fix !== null ? fix : Boolean(fix),
    }
    const hit = keys.map((k) => exceptions.byAdvisory.get(k)).find(Boolean) ?? exceptions.byPackage.get(name)
    if (hit) {
      accepted.push({ ...entry, reason: hit.reason ?? '', reviewBy: hit.review_by ?? '' })
    } else if (entry.devOnly) {
      advisory.push({ ...entry, why: 'dev-only dependency; not shipped to users' })
    } else if (!hasFix) {
      advisory.push({ ...entry, why: 'no fixed version published' })
    } else if (breaking) {
      advisory.push({ ...entry, why: 'only a semver-major (breaking) fix is available' })
    } else {
      blocking.push(entry)
    }
  }
  return { blocking, advisory, accepted }
}

function line(e) {
  const title = (e.titles?.[0] ?? '').trim()
  const ids = (e.advisories ?? []).slice(0, 2).join(', ')
  let fixText = ''
  if (e.fix && typeof e.fix === 'object') {
    fixText = ` — fix: ${e.fix.name}@${e.fix.version}${e.fix.isSemVerMajor ? ' (breaking)' : ''}`
  }
  return `${e.package} [${e.severity}] ${ids}: ${title}${fixText}`
}

export function render({ blocking, advisory, accepted }) {
  const out = ['## Vulnerability triage', '']
  if (blocking.length) {
    out.push(`### Blocking (${blocking.length}) — non-breaking fix available`, '')
    out.push(...blocking.map((e) => `- ${line(e)}`), '')
  }
  if (advisory.length) {
    out.push(`### Not blocking (${advisory.length})`, '')
    out.push(...advisory.map((e) => `- ${line(e)} — _${e.why}_`), '')
  }
  if (accepted.length) {
    out.push(`### Accepted risk (${accepted.length})`, '')
    out.push(...accepted.map((e) => `- ${line(e)} — _${e.reason}_ (review by ${e.reviewBy || 'n/a'})`), '')
  }
  if (!blocking.length && !advisory.length && !accepted.length) out.push('No high or critical advisories.')
  return out.join('\n')
}

function main(argv) {
  const args = argv.slice(2)
  const reportPath = args.find((a) => !a.startsWith('--'))
  const excIdx = args.indexOf('--exceptions')
  const excPath = excIdx >= 0 ? args[excIdx + 1] : undefined

  if (!reportPath) {
    console.error('usage: audit-gate.mjs <audit.json> [--exceptions <file>]')
    return 2
  }
  let report
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'))
  } catch (err) {
    // A missing/!unparseable report means npm audit died before writing output —
    // fail closed rather than silently passing the gate.
    console.error(`::error::vulnerability report unreadable (${reportPath}): ${err.message}`)
    return 1
  }

  const result = triageReport(report, loadExceptions(excPath))
  for (const e of [...result.advisory, ...result.accepted]) console.log(`::warning::${line(e)}`)
  for (const e of result.blocking) console.log(`::error::${line(e)}`)

  const summary = render(result)
  console.log(summary)
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n')
  }
  if (result.blocking.length) {
    console.error(`\n${result.blocking.length} advisory(ies) have a non-breaking fix — upgrade them.`)
    return 1
  }
  return 0
}

// Only run when invoked directly, so the pure functions above stay importable by tests.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  process.exit(main(process.argv))
}
