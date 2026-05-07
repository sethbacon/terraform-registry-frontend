#!/usr/bin/env -S npx tsx
/**
 * contract-check.ts — Verify every API route the frontend calls actually exists on the backend.
 *
 * What this catches: frontend code calling a backend route that does not exist
 * (the same class of bug fixed in terraform-provider-registry#74).
 *
 * What this does NOT catch: request/response body shape drift. Route existence
 * is the cheapest 80% of contract testing.
 *
 * Process:
 *   1. Walk frontend/src/services/api.ts AST. Collect every (method, path) tuple
 *      from `this.client.{get,post,put,patch,delete}(...)` calls. Template literals
 *      like `/api/v1/modules/${ns}/${name}/${system}` normalize to /api/v1/modules/{}/{}/{}.
 *   2. Fetch swagger from the running backend. Parse path templates the same way:
 *      `/api/v1/modules/{namespace}/{name}/{system}` -> /api/v1/modules/{}/{}/{}.
 *   3. Diff. If any (method, path) the frontend calls has no backend match, exit 1
 *      and print the missing tuple along with its source location.
 *
 * Usage:
 *   BACKEND_URL=http://localhost:8080 npx tsx frontend/scripts/contract-check.ts
 *
 * BACKEND_URL defaults to http://localhost:8080.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as ts from 'typescript'

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete'])

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
// scripts/ -> frontend/ -> repo root
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..')
const API_TS_PATH = path.join(REPO_ROOT, 'frontend', 'src', 'services', 'api.ts')
const ALLOWLIST_PATH = path.join(SCRIPT_DIR, 'contract-check.allowlist.json')

type CallSite = { method: string; rawPath: string; normalized: string; line: number }

/** Replace every `{...}` segment with `{}` so different param names match. */
function normalize(p: string): string {
  return p.replace(/\{[^}/]+\}/g, '{}')
}

/**
 * Convert a frontend path template to swagger-style braces, then normalize.
 * Frontend writes `/api/v1/modules/${ns}/${name}/${system}`; we already lowered
 * the template-literal expressions to `{...}` during AST extraction, so the
 * input here looks like `/api/v1/modules/{ns}/{name}/{system}`.
 */
function normalizeFrontendPath(p: string): string {
  return normalize(p)
}

/** Swagger path -> normalized form. `/api/v1/foo/{id}` -> `/api/v1/foo/{}`. */
function normalizeSwaggerPath(p: string): string {
  return normalize(p)
}

/**
 * Extract the static-ish path string from a CallExpression's first argument.
 * Returns the path with `${expr}` segments rendered as `{var}` placeholders,
 * or null if the path is not a string/template-literal we can statically resolve.
 */
function extractPath(arg: ts.Expression): string | null {
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
    return arg.text
  }
  if (ts.isTemplateExpression(arg)) {
    let out = arg.head.text
    for (const span of arg.templateSpans) {
      // Render `${expr}` as `{expr-text}`. We only care about structure, not
      // names; normalize() collapses to {} anyway.
      out += '{x}' + span.literal.text
    }
    return out
  }
  return null
}

function extractCallSites(sourcePath: string): CallSite[] {
  const text = fs.readFileSync(sourcePath, 'utf8')
  const sf = ts.createSourceFile(sourcePath, text, ts.ScriptTarget.Latest, true)
  const sites: CallSite[] = []

  function walk(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      node.expression.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
      node.expression.expression.name.text === 'client' &&
      HTTP_METHODS.has(node.expression.name.text)
    ) {
      const method = node.expression.name.text.toUpperCase()
      const firstArg = node.arguments[0]
      if (firstArg) {
        const rawPath = extractPath(firstArg)
        if (rawPath !== null) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
          sites.push({
            method,
            rawPath,
            normalized: normalizeFrontendPath(rawPath),
            line: line + 1,
          })
        } else {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
          console.warn(
            `WARN: ${path.relative(REPO_ROOT, sourcePath)}:${line + 1} — could not statically resolve path argument to this.client.${node.expression.name.text}(); skipping. Fix by inlining the path literal at the call site.`,
          )
        }
      }
    }
    ts.forEachChild(node, walk)
  }

  walk(sf)
  return sites
}

type SwaggerSpec = {
  paths?: Record<string, Record<string, unknown>>
  basePath?: string
}

async function fetchSwagger(backendURL: string): Promise<SwaggerSpec> {
  const url = backendURL.replace(/\/+$/, '') + '/swagger.json'
  const resp = await fetch(url)
  if (!resp.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${resp.status}`)
  }
  return (await resp.json()) as SwaggerSpec
}

function buildBackendIndex(spec: SwaggerSpec): {
  set: Set<string>
  byNormalized: Map<string, Set<string>>
} {
  const set = new Set<string>()
  const byNormalized = new Map<string, Set<string>>()
  for (const [pathKey, methods] of Object.entries(spec.paths ?? {})) {
    const normalized = normalizeSwaggerPath(pathKey)
    for (const method of Object.keys(methods ?? {})) {
      const upper = method.toUpperCase()
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(upper)) continue
      const key = `${upper} ${normalized}`
      set.add(key)
      if (!byNormalized.has(normalized)) byNormalized.set(normalized, new Set())
      byNormalized.get(normalized)!.add(upper)
    }
  }
  return { set, byNormalized }
}

/** Find the closest backend path for diagnostic output, by normalized-segment-count match. */
function suggestClosest(target: string, byNormalized: Map<string, Set<string>>): string[] {
  const targetSegs = target.split('/').filter(Boolean)
  const candidates: { p: string; score: number }[] = []
  for (const p of Array.from(byNormalized.keys())) {
    const segs = p.split('/').filter(Boolean)
    if (Math.abs(segs.length - targetSegs.length) > 1) continue
    let common = 0
    const lim = Math.min(segs.length, targetSegs.length)
    for (let i = 0; i < lim; i++) {
      if (segs[i] === targetSegs[i]) common++
    }
    if (common >= Math.max(2, lim - 2)) {
      candidates.push({ p, score: common })
    }
  }
  candidates.sort((a, b) => b.score - a.score)
  return candidates.slice(0, 3).map((c) => c.p)
}

type AllowlistEntry = {
  /** HTTP method, uppercase. */
  method: string
  /** Normalized path with `{}` placeholders. */
  path: string
  /** Why this entry exists (tracking issue URL or short rationale). */
  reason: string
}

type Allowlist = {
  /** Entries the check is expected to skip until the linked issue is resolved. */
  entries: AllowlistEntry[]
}

function loadAllowlist(): Allowlist {
  if (!fs.existsSync(ALLOWLIST_PATH)) return { entries: [] }
  const raw = fs.readFileSync(ALLOWLIST_PATH, 'utf8')
  const parsed = JSON.parse(raw) as Allowlist
  if (!Array.isArray(parsed.entries)) {
    throw new Error(`${ALLOWLIST_PATH} is malformed — expected { entries: [...] }`)
  }
  return parsed
}

async function main() {
  const backendURL = process.env.BACKEND_URL || 'http://localhost:8080'

  console.log(`==> Extracting frontend API calls from ${path.relative(REPO_ROOT, API_TS_PATH)}`)
  const sites = extractCallSites(API_TS_PATH)
  console.log(`    Found ${sites.length} call sites`)

  console.log(`==> Fetching swagger from ${backendURL}/swagger.json`)
  const spec = await fetchSwagger(backendURL)
  const { set: backendKeys, byNormalized } = buildBackendIndex(spec)
  console.log(`    Backend has ${backendKeys.size} (method, path) tuples`)

  const allowlist = loadAllowlist()
  const allowKeys = new Set(allowlist.entries.map((e) => `${e.method.toUpperCase()} ${e.path}`))
  if (allowlist.entries.length > 0) {
    console.log(`    Allowlist has ${allowlist.entries.length} entries (see contract-check.allowlist.json)`)
  }

  type Missing = { site: CallSite; suggestions: string[] }
  const missing: Missing[] = []
  const allowedHits: { key: string; reason: string }[] = []

  // Deduplicate by (method, normalized) so the same call from many sites only
  // reports once, but keep the first-seen line for diagnostics.
  const seen = new Set<string>()
  for (const s of sites) {
    const key = `${s.method} ${s.normalized}`
    if (seen.has(key)) continue
    seen.add(key)
    if (backendKeys.has(key)) continue
    if (allowKeys.has(key)) {
      const entry = allowlist.entries.find(
        (e) => e.method.toUpperCase() === s.method && e.path === s.normalized,
      )
      allowedHits.push({ key, reason: entry?.reason ?? '(no reason recorded)' })
      continue
    }
    missing.push({ site: s, suggestions: suggestClosest(s.normalized, byNormalized) })
  }

  // Detect stale allowlist entries (route is now backed by the live backend, or
  // the frontend stopped calling it). These should be removed to keep the
  // allowlist honest.
  const liveCallKeys = new Set(sites.map((s) => `${s.method} ${s.normalized}`))
  const staleAllow = allowlist.entries.filter((e) => {
    const k = `${e.method.toUpperCase()} ${e.path}`
    return backendKeys.has(k) || !liveCallKeys.has(k)
  })

  if (allowedHits.length > 0) {
    console.log(`\n  Skipped (allowlist): ${allowedHits.length}`)
    for (const h of allowedHits) {
      console.log(`    - ${h.key}  (${h.reason})`)
    }
  }

  if (staleAllow.length > 0) {
    console.error(`\nFAIL: ${staleAllow.length} stale allowlist entr(ies). Remove these from contract-check.allowlist.json:`)
    for (const e of staleAllow) {
      const k = `${e.method.toUpperCase()} ${e.path}`
      const why = backendKeys.has(k) ? 'now exists on backend' : 'frontend no longer calls it'
      console.error(`  - ${k}  (${why})`)
    }
    process.exit(1)
  }

  if (missing.length === 0) {
    console.log(`\nOK: every frontend route exists on backend (or is on the allowlist).`)
    process.exit(0)
  }

  console.error(`\nFAIL: ${missing.length} frontend route(s) have no matching backend route:\n`)
  for (const m of missing) {
    console.error(
      `  ${m.site.method} ${m.site.normalized}\n    at frontend/src/services/api.ts:${m.site.line} (raw: ${m.site.rawPath})`,
    )
    if (m.suggestions.length > 0) {
      console.error(`    closest backend paths:`)
      for (const s of m.suggestions) {
        console.error(`      - ${s}`)
      }
    }
    console.error('')
  }
  console.error(
    `If a missing route is intentional and being tracked elsewhere, add an entry to\nfrontend/scripts/contract-check.allowlist.json with the linked issue URL as the reason.`,
  )
  process.exit(1)
}

main().catch((err) => {
  console.error('contract-check failed:', err)
  process.exit(2)
})
