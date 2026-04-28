import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link as RouterLink } from 'react-router-dom'
import {
  Alert,
  AlertTitle,
  Box,
  Collapse,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import apiClient from '../services/api'
import { queryKeys } from '../services/queryKeys'
import type { CVEAdvisory, CVESeverity } from '../types'

// One banner per severity level so colours are consistent and legible.
const SEVERITY_ORDER: CVESeverity[] = ['critical', 'high', 'medium', 'low', 'unknown']

const SEVERITY_LABEL: Record<CVESeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  unknown: 'Unknown',
}

// MUI Alert severity mapping — 'error' gives the red/critical look.
const MUI_SEVERITY: Record<CVESeverity, 'error' | 'warning' | 'info'> = {
  critical: 'error',
  high: 'error',
  medium: 'warning',
  low: 'info',
  unknown: 'info',
}

// Refetch every 5 minutes (matches the backend Cache-Control max-age).
const REFETCH_INTERVAL_MS = 5 * 60 * 1000

// sessionStorage key prefix for per-severity dismissals.
const DISMISS_KEY = 'cve_banner_dismissed_'

function isDismissed(severity: CVESeverity): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY + severity) === '1'
  } catch {
    return false
  }
}

function setDismissed(severity: CVESeverity): void {
  try {
    sessionStorage.setItem(DISMISS_KEY + severity, '1')
  } catch {
    // sessionStorage not available (e.g., private browsing with restrictions) — ignore
  }
}

/**
 * AdvisoryBanner polls the public /api/v1/advisories/active endpoint every
 * 5 minutes and renders a stacked set of MUI Alerts — one per severity level —
 * when active CVE advisories are present. Each band is dismissible for the
 * current browser session.
 *
 * Mount this component once inside Layout, just below <Toolbar />.
 */
export default function AdvisoryBanner() {
  const { data: advisories } = useQuery({
    queryKey: queryKeys.advisories.active(),
    queryFn: () => apiClient.getActiveAdvisories(),
    refetchInterval: REFETCH_INTERVAL_MS,
    // Don't show a loading skeleton — the banner is an enhancement; absence is fine.
    placeholderData: [],
  })

  // Track per-severity dismissal state locally so closing one band doesn't re-render others.
  const [dismissed, setDismissedState] = useState<Partial<Record<CVESeverity, boolean>>>(() => {
    const initial: Partial<Record<CVESeverity, boolean>> = {}
    for (const s of SEVERITY_ORDER) {
      if (isDismissed(s)) initial[s] = true
    }
    return initial
  })

  if (!advisories || advisories.length === 0) return null

  // Group advisories by severity.
  const bySeverity = new Map<CVESeverity, CVEAdvisory[]>()
  for (const adv of advisories) {
    const bucket = bySeverity.get(adv.severity) ?? []
    bucket.push(adv)
    bySeverity.set(adv.severity, bucket)
  }

  const visibleSeverities = SEVERITY_ORDER.filter(
    (s) => bySeverity.has(s) && !dismissed[s],
  )

  if (visibleSeverities.length === 0) return null

  const handleDismiss = (severity: CVESeverity) => {
    setDismissed(severity)
    setDismissedState((prev) => ({ ...prev, [severity]: true }))
  }

  return (
    <Box sx={{ mb: 1 }} role="region" aria-label="Security advisories">
      {visibleSeverities.map((severity) => {
        const group = bySeverity.get(severity)!
        const count = group.length
        const muiSeverity = MUI_SEVERITY[severity]

        // Collect all target kinds present in this severity group.
        const kinds = Array.from(new Set(group.map((a) => a.target_kind))).join(', ')

        return (
          <Collapse key={severity} in unmountOnExit>
            <Alert
              severity={muiSeverity}
              sx={{ borderRadius: 0, mb: 0.5 }}
              action={
                <Tooltip title="Dismiss for this session">
                  <IconButton
                    size="small"
                    color="inherit"
                    aria-label={`Dismiss ${severity} advisory banner`}
                    onClick={() => handleDismiss(severity)}
                  >
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              }
            >
              <AlertTitle>
                {SEVERITY_LABEL[severity]} severity CVE{count > 1 ? 's' : ''} detected ({kinds})
              </AlertTitle>
              <Typography variant="body2" component="span">
                {count === 1
                  ? `${group[0].source_id}: ${group[0].summary}`
                  : `${count} advisories affect your registry's ${kinds}.`}{' '}
                <RouterLink
                  to="/admin/security-scanning"
                  style={{ color: 'inherit', fontWeight: 600 }}
                >
                  Review in Security Scanning →
                </RouterLink>
              </Typography>
            </Alert>
          </Collapse>
        )
      })}
    </Box>
  )
}
