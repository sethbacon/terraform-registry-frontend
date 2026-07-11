import type { FindingRow } from '../types'

type Severity = FindingRow['severity']

const SEVERITY_ORDER: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
}

function normalizeSeverity(raw: string): Severity | null {
  const upper = String(raw).toUpperCase()
  if (upper === 'CRITICAL' || upper === 'HIGH' || upper === 'MEDIUM' || upper === 'LOW') {
    return upper as Severity
  }
  return null
}

function sarifLevelToSeverity(level: string): Severity | null {
  switch (String(level).toLowerCase()) {
    case 'error':
      return 'HIGH'
    case 'warning':
      return 'MEDIUM'
    case 'note':
      return 'LOW'
    default:
      return null
  }
}

// A boundary type guard: confirms `value` is at least a non-null object so it
// can be cast to one of the loosely-typed raw shapes below. The cast trusts
// the shape for property *names* (so a typo like `v.Severty` is a compile
// error) but every field stays optional and every array access still goes
// through Array.isArray -- the runtime tolerance for malformed scanner
// output is unchanged, only the `any` escape hatch is removed.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// ---------------------------------------------------------------------------
// Trivy
// ---------------------------------------------------------------------------
interface TrivyVulnerability {
  Severity?: string
  VulnerabilityID?: string
  AVDID?: string
  Title?: string
  PkgName?: string
  FixedVersion?: string
}

interface TrivyMisconfiguration {
  Severity?: string
  ID?: string
  AVDID?: string
  Title?: string
  CauseMetadata?: { Resource?: string }
  Resolution?: string
}

interface TrivyResult {
  Target?: string
  Vulnerabilities?: TrivyVulnerability[]
  Misconfigurations?: TrivyMisconfiguration[]
}

interface TrivyRaw {
  Results?: TrivyResult[]
}

function parseTrivy(raw: unknown): FindingRow[] {
  const rows: FindingRow[] = []
  const data = isRecord(raw) ? (raw as TrivyRaw) : {}
  const results = Array.isArray(data.Results) ? data.Results : []
  for (const result of results) {
    const target = String(result?.Target ?? '')
    for (const v of Array.isArray(result?.Vulnerabilities) ? result.Vulnerabilities : []) {
      const sev = normalizeSeverity(v?.Severity ?? '')
      if (!sev) continue
      rows.push({
        severity: sev,
        ruleId: String(v?.VulnerabilityID ?? v?.AVDID ?? ''),
        title: String(v?.Title ?? ''),
        resource: String(v?.PkgName ?? ''),
        file: target,
        resolution: String(v?.FixedVersion ? `Upgrade to ${v.FixedVersion}` : ''),
      })
    }
    for (const m of Array.isArray(result?.Misconfigurations) ? result.Misconfigurations : []) {
      const sev = normalizeSeverity(m?.Severity ?? '')
      if (!sev) continue
      rows.push({
        severity: sev,
        ruleId: String(m?.ID ?? m?.AVDID ?? ''),
        title: String(m?.Title ?? ''),
        resource: String(m?.CauseMetadata?.Resource ?? ''),
        file: target,
        resolution: String(m?.Resolution ?? ''),
      })
    }
  }
  return rows
}

// ---------------------------------------------------------------------------
// Checkov
// ---------------------------------------------------------------------------
interface CheckovFailedCheck {
  check?: { id?: string; name?: string; severity?: string }
  resource?: string
  file_path?: string
  guideline?: string
}

interface CheckovRaw {
  results?: { failed_checks?: CheckovFailedCheck[] }
}

function parseCheckovSingle(raw: unknown): FindingRow[] {
  const rows: FindingRow[] = []
  const obj = isRecord(raw) ? (raw as CheckovRaw) : {}
  const checks = Array.isArray(obj.results?.failed_checks) ? obj.results.failed_checks : []
  for (const fc of checks) {
    const sev = normalizeSeverity(fc?.check?.severity ?? '')
    if (!sev) continue
    rows.push({
      severity: sev,
      ruleId: String(fc?.check?.id ?? ''),
      title: String(fc?.check?.name ?? ''),
      resource: String(fc?.resource ?? ''),
      file: String(fc?.file_path ?? ''),
      resolution: String(fc?.guideline ?? ''),
    })
  }
  return rows
}

function parseCheckov(raw: unknown): FindingRow[] {
  if (Array.isArray(raw)) {
    return raw.flatMap(parseCheckovSingle)
  }
  return parseCheckovSingle(raw)
}

// ---------------------------------------------------------------------------
// Terrascan
// ---------------------------------------------------------------------------
interface TerrascanViolation {
  severity?: string
  rule_id?: string
  rule_name?: string
  description?: string
  resource_name?: string
  file?: string
}

interface TerrascanRaw {
  results?: { violations?: TerrascanViolation[] }
}

function parseTerrascan(raw: unknown): FindingRow[] {
  const rows: FindingRow[] = []
  const data = isRecord(raw) ? (raw as TerrascanRaw) : {}
  const violations = Array.isArray(data.results?.violations) ? data.results.violations : []
  for (const v of violations) {
    const sev = normalizeSeverity(v?.severity ?? '')
    if (!sev) continue
    rows.push({
      severity: sev,
      ruleId: String(v?.rule_id ?? ''),
      title: String(v?.rule_name ?? v?.description ?? ''),
      resource: String(v?.resource_name ?? ''),
      file: String(v?.file ?? ''),
      resolution: '',
    })
  }
  return rows
}

// ---------------------------------------------------------------------------
// Snyk
// ---------------------------------------------------------------------------
interface SnykVulnerability {
  severity?: string
  id?: string
  title?: string
  remediation?: { advice?: string }
}

interface SnykRaw {
  vulnerabilities?: SnykVulnerability[]
}

function parseSnykSingle(raw: unknown): FindingRow[] {
  const rows: FindingRow[] = []
  const obj = isRecord(raw) ? (raw as SnykRaw) : {}
  const vulns = Array.isArray(obj.vulnerabilities) ? obj.vulnerabilities : []
  for (const v of vulns) {
    const sev = normalizeSeverity(v?.severity ?? '')
    if (!sev) continue
    rows.push({
      severity: sev,
      ruleId: String(v?.id ?? ''),
      title: String(v?.title ?? ''),
      resource: '',
      file: '',
      resolution: String(v?.remediation?.advice ?? ''),
    })
  }
  return rows
}

function parseSnyk(raw: unknown): FindingRow[] {
  if (Array.isArray(raw)) {
    return raw.flatMap(parseSnykSingle)
  }
  return parseSnykSingle(raw)
}

// ---------------------------------------------------------------------------
// SARIF
// ---------------------------------------------------------------------------
interface SarifResult {
  level?: string
  ruleId?: string
  message?: { text?: string }
  locations?: Array<{ physicalLocation?: { artifactLocation?: { uri?: string } } }>
}

interface SarifRun {
  results?: SarifResult[]
}

interface SarifRaw {
  runs?: SarifRun[]
}

function parseSarif(raw: unknown): FindingRow[] {
  const rows: FindingRow[] = []
  const data = isRecord(raw) ? (raw as SarifRaw) : {}
  const runs = Array.isArray(data.runs) ? data.runs : []
  for (const run of runs) {
    for (const r of Array.isArray(run?.results) ? run.results : []) {
      const sev = sarifLevelToSeverity(r?.level ?? '')
      if (!sev) continue
      const loc = r?.locations?.[0]?.physicalLocation
      rows.push({
        severity: sev,
        ruleId: String(r?.ruleId ?? ''),
        title: String(r?.message?.text ?? ''),
        resource: '',
        file: String(loc?.artifactLocation?.uri ?? ''),
        resolution: '',
      })
    }
  }
  return rows
}

export function parseScanFindings(
  scanner: string,
  rawResults: Record<string, unknown> | null,
): FindingRow[] {
  if (!rawResults) return []

  let rows: FindingRow[]
  const s = scanner.toLowerCase()
  if (s === 'trivy') {
    rows = parseTrivy(rawResults)
  } else if (s === 'checkov') {
    rows = parseCheckov(rawResults)
  } else if (s === 'terrascan') {
    rows = parseTerrascan(rawResults)
  } else if (s === 'snyk') {
    rows = parseSnyk(rawResults)
  } else if (rawResults.runs) {
    rows = parseSarif(rawResults)
  } else if (Array.isArray(rawResults.Results)) {
    rows = parseTrivy(rawResults)
  } else if (Array.isArray((rawResults.results as { failed_checks?: unknown })?.failed_checks)) {
    rows = parseCheckov(rawResults)
  } else if (Array.isArray((rawResults.results as { violations?: unknown })?.violations)) {
    rows = parseTerrascan(rawResults)
  } else if (Array.isArray(rawResults.vulnerabilities)) {
    rows = parseSnyk(rawResults)
  } else {
    rows = []
  }

  rows.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
  return rows
}
