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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTrivy(raw: any): FindingRow[] {
  const rows: FindingRow[] = []
  const results = Array.isArray(raw?.Results) ? raw.Results : []
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCheckovSingle(obj: any): FindingRow[] {
  const rows: FindingRow[] = []
  const checks = Array.isArray(obj?.results?.failed_checks) ? obj.results.failed_checks : []
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCheckov(raw: any): FindingRow[] {
  if (Array.isArray(raw)) {
    return raw.flatMap(parseCheckovSingle)
  }
  return parseCheckovSingle(raw)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTerrascan(raw: any): FindingRow[] {
  const rows: FindingRow[] = []
  const violations = Array.isArray(raw?.results?.violations) ? raw.results.violations : []
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSnykSingle(obj: any): FindingRow[] {
  const rows: FindingRow[] = []
  const vulns = Array.isArray(obj?.vulnerabilities) ? obj.vulnerabilities : []
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSnyk(raw: any): FindingRow[] {
  if (Array.isArray(raw)) {
    return raw.flatMap(parseSnykSingle)
  }
  return parseSnykSingle(raw)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSarif(raw: any): FindingRow[] {
  const rows: FindingRow[] = []
  const runs = Array.isArray(raw?.runs) ? raw.runs : []
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } else if (Array.isArray((rawResults as any)?.Results)) {
    rows = parseTrivy(rawResults)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } else if (Array.isArray((rawResults as any)?.results?.failed_checks)) {
    rows = parseCheckov(rawResults)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } else if (Array.isArray((rawResults as any)?.results?.violations)) {
    rows = parseTerrascan(rawResults)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } else if (Array.isArray((rawResults as any)?.vulnerabilities)) {
    rows = parseSnyk(rawResults)
  } else {
    rows = []
  }

  rows.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
  return rows
}
