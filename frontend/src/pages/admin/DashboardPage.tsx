import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../services/queryKeys'
import {
  Container,
  Typography,
  Box,
  Grid,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Button,
} from '@mui/material'
import ViewModule from '@mui/icons-material/ViewModule'
import Extension from '@mui/icons-material/Extension'
import Download from '@mui/icons-material/Download'
import GetApp from '@mui/icons-material/GetApp'
import CloudDownload from '@mui/icons-material/CloudDownload'
import CloudUpload from '@mui/icons-material/CloudUpload'
import People from '@mui/icons-material/People'
import Key from '@mui/icons-material/Key'
import GitHub from '@mui/icons-material/GitHub'
import Storage from '@mui/icons-material/Storage'
import CheckCircle from '@mui/icons-material/CheckCircle'
import Error from '@mui/icons-material/Error'
import Sync from '@mui/icons-material/Sync'
import Refresh from '@mui/icons-material/Refresh'
import ArrowForward from '@mui/icons-material/ArrowForward'
import Security from '@mui/icons-material/Security'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import QuotaUsageChart from '../../components/QuotaUsageChart'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecentSyncEntry {
  mirror_name: string
  mirror_type: 'binary' | 'provider'
  status: string
  started_at: string
  completed_at?: string | null
  versions_synced: number
  platforms_synced: number
  triggered_by: string
}

interface ModuleSystemCount {
  system: string
  count: number
}

interface BinaryToolCount {
  tool: string
  platforms: number
}

interface DashboardData {
  modules: { total: number; versions: number; downloads: number; by_system: ModuleSystemCount[] }
  providers: {
    total: number
    manual: number
    mirrored: number
    total_versions: number
    manual_versions: number
    mirrored_versions: number
    downloads: number
  }
  users: number
  organizations: number
  downloads: number
  scm_providers: number
  binary_mirrors: {
    total: number
    healthy: number
    failed: number
    syncing: number
    platforms: number
    downloads: number
    by_tool: BinaryToolCount[]
  }
  provider_mirrors: {
    total: number
    healthy: number
    failed: number
  }
  scanning: {
    enabled: boolean
    total: number
    pending: number
    clean: number
    findings: number
    error: number
  }
  recent_syncs: RecentSyncEntry[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function syncStatusChip(status: string) {
  switch (status) {
    case 'success':
      return <Chip label="success" size="small" color="success" variant="outlined" />
    case 'failed':
      return <Chip label="failed" size="small" color="error" variant="outlined" />
    case 'running':
      return <Chip label="running" size="small" color="info" variant="outlined" />
    default:
      return <Chip label={status} size="small" variant="outlined" />
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface HealthPillProps {
  label: string
  total: number
  failed: number
  syncing?: number
  icon: React.ReactNode
  route: string
}

const HealthPill: React.FC<HealthPillProps> = ({
  label,
  total,
  failed,
  syncing = 0,
  icon,
  route,
}) => {
  const navigate = useNavigate()
  const hasIssue = failed > 0
  const isSyncing = syncing > 0

  const colour = hasIssue ? 'error.main' : isSyncing ? 'info.main' : 'success.main'
  const StatusIcon = hasIssue ? Error : isSyncing ? Sync : CheckCircle

  return (
    <Tooltip
      title={
        hasIssue
          ? `${failed} of ${total} failed`
          : isSyncing
            ? `${syncing} syncing`
            : total === 0
              ? 'None configured'
              : 'All healthy'
      }
    >
      <Paper
        onClick={() => navigate(route)}
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          cursor: 'pointer',
          flex: 1,
          minWidth: 160,
          transition: 'box-shadow 0.15s',
          '&:hover': { boxShadow: 3 },
        }}
      >
        <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icon}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" noWrap>
            {label}
          </Typography>
          <Typography variant="body2" fontWeight={600} noWrap>
            {total === 0 ? 'None' : `${total - failed} / ${total} OK`}
          </Typography>
        </Box>
        <Box sx={{ color: colour, display: 'flex' }}>
          <StatusIcon fontSize="small" />
        </Box>
      </Paper>
    </Tooltip>
  )
}

interface StatCardProps {
  title: string
  value: number
  sub?: string
  icon: React.ReactNode
  accentColor: string
  route: string
  aside?: React.ReactNode
  compact?: boolean
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  sub,
  icon,
  accentColor,
  route,
  aside,
  compact,
}) => {
  const navigate = useNavigate()
  return (
    <Paper
      onClick={() => navigate(route)}
      sx={{
        p: compact ? 1.75 : 2.5,
        display: 'flex',
        alignItems: 'stretch',
        gap: compact ? 1.25 : 2,
        cursor: 'pointer',
        borderLeft: `4px solid ${accentColor}`,
        minHeight: 110,
        transition: 'transform 0.15s, box-shadow 0.15s',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
      }}
    >
      <Box sx={{ color: accentColor, display: 'flex', alignSelf: 'center' }}>{icon}</Box>
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minWidth: 0,
        }}
      >
        <Typography variant={compact ? 'h5' : 'h4'} fontWeight={700} lineHeight={1.1}>
          {fmtNumber(value)}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {title}
        </Typography>
        {/* Reserve space for sub-line even when absent so all cards stay the same height */}
        <Typography
          variant="caption"
          color="text.disabled"
          display="block"
          mt={0.25}
          sx={{ minHeight: '1.2em' }}
          noWrap
        >
          {sub ?? ''}
        </Typography>
      </Box>
      {aside && (
        <>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minWidth: 90,
              maxWidth: 110,
            }}
          >
            {aside}
          </Box>
        </>
      )}
    </Paper>
  )
}

// Two-row breakdown for provider manual vs mirrored.
interface ProviderBreakdownProps {
  manual: number
  mirrored: number
  manualVersions: number
  mirroredVersions: number
  color: string
}
const ProviderBreakdown: React.FC<ProviderBreakdownProps> = ({
  manual,
  mirrored,
  manualVersions,
  mirroredVersions,
  color,
}) => {
  const total = manual + mirrored
  if (total === 0) return null
  const manualPct = Math.round((manual / total) * 100)
  const mirroredPct = 100 - manualPct
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {[
        { label: 'Manual', count: manual, versions: manualVersions, pct: manualPct, shade: color },
        {
          label: 'Mirrored',
          count: mirrored,
          versions: mirroredVersions,
          pct: mirroredPct,
          shade: '#7E57C2',
        },
      ].map((row) => (
        <Tooltip key={row.label} title={`${row.versions} versions`} placement="left">
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
              <Typography variant="caption" sx={{ lineHeight: 1.2 }}>
                {row.label}
              </Typography>
              <Typography variant="caption" fontWeight={600} sx={{ lineHeight: 1.2, ml: 0.5 }}>
                {row.count}
              </Typography>
            </Box>
            <Box sx={{ height: 3, borderRadius: 1, bgcolor: 'action.hover' }}>
              <Box sx={{ height: 3, borderRadius: 1, bgcolor: row.shade, width: `${row.pct}%` }} />
            </Box>
          </Box>
        </Tooltip>
      ))}
    </Box>
  )
}

// Compact vertical list of system → count with a proportional bar.
const SystemBreakdown: React.FC<{ items: ModuleSystemCount[]; total: number; color: string }> = ({
  items,
  total,
  color,
}) => {
  if (items.length === 0) return null
  const max = items[0].count // already sorted desc
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {items.slice(0, 5).map((item) => (
        <Tooltip key={item.system} title={`${item.count} of ${total} modules`} placement="left">
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
              <Typography variant="caption" noWrap sx={{ maxWidth: 66, lineHeight: 1.2 }}>
                {item.system}
              </Typography>
              <Typography variant="caption" fontWeight={600} sx={{ lineHeight: 1.2, ml: 0.5 }}>
                {item.count}
              </Typography>
            </Box>
            <Box sx={{ height: 3, borderRadius: 1, bgcolor: 'action.hover' }}>
              <Box
                sx={{
                  height: 3,
                  borderRadius: 1,
                  bgcolor: color,
                  width: `${(item.count / max) * 100}%`,
                }}
              />
            </Box>
          </Box>
        </Tooltip>
      ))}
    </Box>
  )
}

// Per-tool platform count (terraform vs opentofu).
const BinaryToolBreakdown: React.FC<{ items: BinaryToolCount[]; color: string }> = ({
  items,
  color,
}) => {
  if (items.length === 0) return null
  const max = items[0].platforms
  const labelFor = (tool: string) =>
    tool === 'terraform' ? 'Hashicorp' : tool === 'opentofu' ? 'OpenTofu' : tool
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {items.map((item) => (
        <Tooltip key={item.tool} title={`${item.platforms} platform binaries`} placement="left">
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
              <Typography variant="caption" noWrap sx={{ lineHeight: 1.2 }}>
                {labelFor(item.tool)}
              </Typography>
              <Typography variant="caption" fontWeight={600} sx={{ lineHeight: 1.2, ml: 0.5 }}>
                {item.platforms}
              </Typography>
            </Box>
            <Box sx={{ height: 3, borderRadius: 1, bgcolor: 'action.hover' }}>
              <Box
                sx={{
                  height: 3,
                  borderRadius: 1,
                  bgcolor: color,
                  width: `${(item.platforms / max) * 100}%`,
                }}
              />
            </Box>
          </Box>
        </Tooltip>
      ))}
    </Box>
  )
}

// Downloads split by source type.
const DownloadBreakdown: React.FC<{
  moduleDownloads: number
  providerDownloads: number
  binaryDownloads: number
}> = ({ moduleDownloads, providerDownloads, binaryDownloads }) => {
  const total = moduleDownloads + providerDownloads + binaryDownloads
  if (total === 0)
    return (
      <Typography variant="caption" color="text.disabled">
        No downloads yet
      </Typography>
    )
  const rows = [
    { label: 'Modules', count: moduleDownloads, color: '#5C4EE5' },
    { label: 'Providers', count: providerDownloads, color: '#00D9C0' },
    { label: 'Binaries', count: binaryDownloads, color: '#FF7043' },
  ]
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {rows.map((row) => (
        <Box key={row.label}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
            <Typography variant="caption" sx={{ lineHeight: 1.2 }}>
              {row.label}
            </Typography>
            <Typography variant="caption" fontWeight={600} sx={{ lineHeight: 1.2, ml: 0.5 }}>
              {fmtNumber(row.count)}
            </Typography>
          </Box>
          <Box sx={{ height: 3, borderRadius: 1, bgcolor: 'action.hover' }}>
            <Box
              sx={{
                height: 3,
                borderRadius: 1,
                bgcolor: row.color,
                width: total > 0 ? `${(row.count / total) * 100}%` : '0%',
              }}
            />
          </Box>
        </Box>
      ))}
    </Box>
  )
}

interface QuickLinkProps {
  label: string
  icon: React.ReactNode
  route: string
  color: string
}

const QuickLink: React.FC<QuickLinkProps> = ({ label, icon, route, color }) => {
  const navigate = useNavigate()
  return (
    <Paper
      onClick={() => navigate(route)}
      sx={{
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        cursor: 'pointer',
        transition: 'background-color 0.15s, box-shadow 0.15s',
        '&:hover': { boxShadow: 2, bgcolor: 'action.hover' },
      }}
    >
      <Box sx={{ color, display: 'flex' }}>{icon}</Box>
      <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
        {label}
      </Typography>
      <ArrowForward fontSize="small" sx={{ color: 'text.disabled' }} />
    </Paper>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const DashboardPage: React.FC = () => {
  const { allowedScopes } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const {
    data: raw,
    isLoading: loading,
    isFetching: refreshing,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: () => api.getDashboardStats(),
  })

  const { data: quotas } = useQuery({
    queryKey: queryKeys.quotas.list(),
    queryFn: () => api.getOrgQuotas(),
    retry: false,
  })

  const error = queryError ? 'Failed to load dashboard statistics.' : null

  // Normalise: backend may not yet have mirror fields on older builds.
  const data: DashboardData | null = raw
    ? {
      modules: raw.modules ?? { total: 0, versions: 0, downloads: 0, by_system: [] },
      providers: raw.providers ?? {
        total: 0,
        manual: 0,
        mirrored: 0,
        total_versions: 0,
        manual_versions: 0,
        mirrored_versions: 0,
        downloads: 0,
      },
      users: raw.users ?? 0,
      organizations: raw.organizations ?? 0,
      downloads: raw.downloads ?? 0,
      scm_providers: raw.scm_providers ?? 0,
      binary_mirrors: raw.binary_mirrors ?? {
        total: 0,
        healthy: 0,
        failed: 0,
        syncing: 0,
        platforms: 0,
        downloads: 0,
        by_tool: [],
      },
      provider_mirrors: raw.provider_mirrors ?? { total: 0, healthy: 0, failed: 0 },
      scanning: raw.scanning ?? {
        enabled: false,
        total: 0,
        pending: 0,
        clean: 0,
        findings: 0,
        error: 0,
      },
      recent_syncs: raw.recent_syncs ?? [],
    }
    : null

  const hasScope = (scope: string) =>
    allowedScopes.includes('admin') || allowedScopes.includes(scope)

  // ---- Zone 1: health pills ------------------------------------------------
  const anyMirrorIssue = data
    ? data.binary_mirrors.failed > 0 || data.provider_mirrors.failed > 0
    : false

  // ---- Zone 2: stat cards --------------------------------------------------
  const statCards: (StatCardProps & { scope: string | null; gridMd: number })[] = !data
    ? []
    : [
      // Row 1 — content cards (each md=6)
      {
        title: 'Modules',
        value: data.modules.total,
        sub: `${data.modules.versions} versions`,
        icon: <ViewModule sx={{ fontSize: 36 }} />,
        accentColor: '#5C4EE5',
        route: '/modules',
        scope: 'modules:read',
        gridMd: 6,
        aside:
          data.modules.by_system?.length > 0 ? (
            <SystemBreakdown
              items={data.modules.by_system}
              total={data.modules.total}
              color="#5C4EE5"
            />
          ) : undefined,
      },
      {
        title: 'Providers',
        value: data.providers.total,
        sub: `${data.providers.total_versions} versions`,
        icon: <Extension sx={{ fontSize: 36 }} />,
        accentColor: '#00D9C0',
        route: '/providers',
        scope: 'providers:read',
        gridMd: 6,
        aside:
          data.providers.total > 0 ? (
            <ProviderBreakdown
              manual={data.providers.manual}
              mirrored={data.providers.mirrored}
              manualVersions={data.providers.manual_versions}
              mirroredVersions={data.providers.mirrored_versions}
              color="#00D9C0"
            />
          ) : undefined,
      },
      // Row 2 — mirror/download summary (each md=6)
      {
        title: 'Terraform Binaries',
        value: data.binary_mirrors.platforms,
        sub: `across ${data.binary_mirrors.total} mirror${data.binary_mirrors.total !== 1 ? 's' : ''}`,
        icon: <GetApp sx={{ fontSize: 36 }} />,
        accentColor: '#FF7043',
        route: '/admin/terraform-mirror',
        scope: 'mirrors:read',
        gridMd: 6,
        aside:
          data.binary_mirrors.by_tool?.length > 0 ? (
            <BinaryToolBreakdown items={data.binary_mirrors.by_tool} color="#FF7043" />
          ) : undefined,
      },
      {
        title: 'Total Downloads',
        value: data.downloads,
        icon: <Download sx={{ fontSize: 36 }} />,
        accentColor: '#FFB74D',
        route: '/modules',
        scope: null,
        gridMd: 6,
        aside: (
          <DownloadBreakdown
            moduleDownloads={data.modules.downloads}
            providerDownloads={data.providers.downloads}
            binaryDownloads={data.binary_mirrors.downloads}
          />
        ),
      },
    ].filter((c) => c.scope === null || hasScope(c.scope))

  // ---- Zone 3 left: recent syncs -------------------------------------------
  const recentSyncs = data ? data.recent_syncs.slice(0, 8) : []

  // ---- Zone 3 right: quick links -------------------------------------------
  const quickLinks: (QuickLinkProps & { scope: string | null })[] = [
    {
      label: 'Upload Module',
      icon: <CloudUpload fontSize="small" />,
      route: '/admin/upload/module',
      color: '#5C4EE5',
      scope: 'modules:write',
    },
    {
      label: 'Upload Provider',
      icon: <CloudUpload fontSize="small" />,
      route: '/admin/upload/provider',
      color: '#00D9C0',
      scope: 'providers:write',
    },
    {
      label: 'Provider Mirrors',
      icon: <CloudDownload fontSize="small" />,
      route: '/admin/mirrors',
      color: '#7E57C2',
      scope: 'mirrors:read',
    },
    {
      label: 'Binary Mirrors',
      icon: <GetApp fontSize="small" />,
      route: '/admin/terraform-mirror',
      color: '#FF7043',
      scope: 'mirrors:read',
    },
    {
      label: 'Manage Users',
      icon: <People fontSize="small" />,
      route: '/admin/users',
      color: '#EF5350',
      scope: 'users:read',
    },
    {
      label: 'API Keys',
      icon: <Key fontSize="small" />,
      route: '/admin/apikeys',
      color: '#FFB74D',
      scope: null,
    },
    {
      label: 'SCM Providers',
      icon: <GitHub fontSize="small" />,
      route: '/admin/scm-providers',
      color: '#6E5494',
      scope: 'scm:read',
    },
    {
      label: 'Storage',
      icon: <Storage fontSize="small" />,
      route: '/admin/storage',
      color: '#78909C',
      scope: 'admin',
    },
  ].filter((l) => l.scope === null || hasScope(l.scope))

  return (
    <Container maxWidth="lg" sx={{ py: 4 }} aria-busy={loading} aria-live="polite">
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      ) : error || !data ? (
        <Alert severity="error">{error ?? 'Failed to load dashboard'}</Alert>
      ) : (
        <>
          {/* Header */}
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}
          >
            <Box>
              <Typography variant="h4" fontWeight={700}>
                Dashboard
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Registry health at a glance
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() })
              }
              disabled={refreshing}
            >
              Refresh
            </Button>
          </Box>

          {/* Zone 1 — System health bar */}
          {anyMirrorIssue && (
            <Alert severity="error" sx={{ mb: 2 }}>
              One or more mirrors have failed their last sync. Check the mirror pages for details.
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 4 }}>
            {hasScope('mirrors:read') && (
              <>
                <HealthPill
                  label="Binary Mirrors"
                  total={data.binary_mirrors.total}
                  failed={data.binary_mirrors.failed}
                  syncing={data.binary_mirrors.syncing}
                  icon={<GetApp fontSize="small" />}
                  route="/admin/terraform-mirror"
                />
                <HealthPill
                  label="Provider Mirrors"
                  total={data.provider_mirrors.total}
                  failed={data.provider_mirrors.failed}
                  icon={<CloudDownload fontSize="small" />}
                  route="/admin/mirrors"
                />
              </>
            )}
            {hasScope('admin') && (
              <HealthPill
                label="Storage"
                total={1}
                failed={0}
                icon={<Storage fontSize="small" />}
                route="/admin/storage"
              />
            )}
            {hasScope('admin') && data.scanning.enabled && (
              <Tooltip
                title={
                  data.scanning.total === 0
                    ? 'No modules scanned yet'
                    : `${data.scanning.clean} clean · ${data.scanning.findings} with findings · ${data.scanning.pending} pending · ${data.scanning.error} errors`
                }
              >
                <Paper
                  onClick={() => navigate('/admin/security-scanning')}
                  sx={{
                    px: 2,
                    py: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    cursor: 'pointer',
                    flex: 1,
                    minWidth: 220,
                    transition: 'box-shadow 0.15s',
                    '&:hover': { boxShadow: 3 },
                  }}
                >
                  <Box sx={{ color: 'text.secondary', display: 'flex' }}>
                    <Security fontSize="small" />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      Security Scanning
                    </Typography>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {data.scanning.total === 0
                        ? 'None'
                        : `${data.scanning.total - data.scanning.error} / ${data.scanning.total} OK`}
                    </Typography>
                    {data.scanning.total > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                        {data.scanning.clean > 0 && (
                          <Chip
                            label={`${data.scanning.clean} clean`}
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                        {data.scanning.findings > 0 && (
                          <Chip
                            label={`${data.scanning.findings} findings`}
                            size="small"
                            color="warning"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate('/admin/security-scanning')
                            }}
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              cursor: 'pointer',
                              '&:hover': { textDecoration: 'underline' },
                            }}
                          />
                        )}
                        {data.scanning.pending > 0 && (
                          <Chip
                            label={`${data.scanning.pending} pending`}
                            size="small"
                            color="info"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                        {data.scanning.error > 0 && (
                          <Chip
                            label={`${data.scanning.error} errors`}
                            size="small"
                            color="error"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                    )}
                  </Box>
                  <Box
                    sx={{
                      color:
                        data.scanning.error > 0
                          ? 'error.main'
                          : data.scanning.findings > 0
                            ? 'warning.main'
                            : data.scanning.pending > 0
                              ? 'info.main'
                              : 'success.main',
                      display: 'flex',
                    }}
                  >
                    {data.scanning.error > 0 ? (
                      <Error fontSize="small" />
                    ) : data.scanning.pending > 0 ? (
                      <Sync fontSize="small" />
                    ) : (
                      <CheckCircle fontSize="small" />
                    )}
                  </Box>
                </Paper>
              </Tooltip>
            )}
          </Box>

          {/* Zone 2 — Stat cards */}
          <Grid container spacing={2.5} sx={{ mb: 4 }}>
            {statCards.map((card) => (
              <Grid size={{ xs: 12, sm: 6, md: card.gridMd }} key={card.title}>
                <StatCard {...card} />
              </Grid>
            ))}
          </Grid>

          <Divider sx={{ mb: 4 }} />

          {/* Zone 2.5 — Quota usage (only shown when quotas are configured) */}
          {quotas && quotas.length > 0 && (
            <>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Resource Quotas
              </Typography>
              <Grid container spacing={2} sx={{ mb: 4 }}>
                {quotas.map((q) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={q.organization_id}>
                    <QuotaUsageChart quota={q} />
                  </Grid>
                ))}
              </Grid>
              <Divider sx={{ mb: 4 }} />
            </>
          )}

          {/* Zone 3 — Recent syncs + quick links */}
          <Grid container spacing={3}>
            {/* Recent sync activity */}
            <Grid size={{ xs: 12, md: 8 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Recent Sync Activity
              </Typography>
              {recentSyncs.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No sync history yet. Trigger a sync from the mirror pages.
                  </Typography>
                </Paper>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Mirror</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Synced</TableCell>
                        <TableCell align="right">Platforms</TableCell>
                        <TableCell align="right">When</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentSyncs.map((s, i) => (
                        <TableRow key={i} hover>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace" noWrap>
                              {s.mirror_name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={s.mirror_type}
                              size="small"
                              color={s.mirror_type === 'binary' ? 'warning' : 'default'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>{syncStatusChip(s.status)}</TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">{s.versions_synced}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {s.mirror_type === 'binary' ? s.platforms_synced : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title={new Date(s.started_at).toLocaleString()}>
                              <Typography variant="caption" color="text.secondary">
                                {timeAgo(s.started_at)}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Grid>

            {/* Quick links */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Quick Links
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {quickLinks.map((link) => (
                  <QuickLink key={link.label} {...link} />
                ))}
              </Box>
            </Grid>
          </Grid>
        </>
      )}
    </Container>
  )
}

export default DashboardPage
