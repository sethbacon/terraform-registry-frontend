import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Typography,
  Box,
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
  Grid,
  IconButton,
  Collapse,
  TablePagination,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Switch,
} from '@mui/material'
import CheckCircle from '@mui/icons-material/CheckCircle'
import Error from '@mui/icons-material/Error'
import HourglassEmpty from '@mui/icons-material/HourglassEmpty'
import WarningAmber from '@mui/icons-material/WarningAmber'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight'
import Page from '../../components/Page'
import PageHeader from '../../components/PageHeader'
import PageTitleIcon from '@mui/icons-material/Security'
import ScanDiagnostics from '../../components/ScanDiagnostics'
import ScanFindingsModal from '../../components/ScanFindingsModal'
import api from '../../services/api'
import { queryKeys } from '../../services/queryKeys'
import { useAuth } from '../../contexts/AuthContext'
import { getErrorMessage } from '../../utils/errors'
import type {
  ModuleScan,
  RecentScanEntry,
  ScannerLatestInfo,
  ScannerAutoUpdateInput,
} from '../../types'

function statusChip(t: TFunction, status: string, onClick?: () => void) {
  const clickProps = onClick ? { onClick, sx: { cursor: 'pointer' } } : {}
  switch (status) {
    case 'clean':
      return (
        <Chip
          label={t('admin.securityScanning.statusClean')}
          size="small"
          color="success"
          variant="outlined"
        />
      )
    case 'findings':
      return (
        <Chip
          label={t('admin.securityScanning.statusFindings')}
          size="small"
          color="warning"
          variant="outlined"
          {...clickProps}
        />
      )
    case 'error':
      return (
        <Chip
          label={t('admin.securityScanning.statusError')}
          size="small"
          color="error"
          variant="outlined"
        />
      )
    case 'pending':
      return (
        <Chip label={t('admin.securityScanning.statusPending')} size="small" variant="outlined" />
      )
    case 'scanning':
      return (
        <Chip
          label={t('admin.securityScanning.statusScanning')}
          size="small"
          color="info"
          variant="outlined"
        />
      )
    default:
      return <Chip label={status} size="small" variant="outlined" />
  }
}

function timeAgo(t: TFunction, iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return t('admin.securityScanning.timeJustNow')
  if (mins < 60) return t('admin.securityScanning.timeMinsAgo', { count: mins })
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return t('admin.securityScanning.timeHoursAgo', { count: hrs })
  return t('admin.securityScanning.timeDaysAgo', { count: Math.floor(hrs / 24) })
}

interface ScannerHealth {
  lastSuccess: RecentScanEntry | null
  lastError: RecentScanEntry | null
  errorRatePct: number
  windowSize: number
}

function computeScannerHealth(scans: RecentScanEntry[]): ScannerHealth {
  // Health is computed from the last 20 scans the API returns. Pending and
  // in-progress scans are excluded from the error-rate denominator since
  // they have no terminal outcome yet.
  const window = scans.slice(0, 20)
  const terminal = window.filter(
    (s) => s.status === 'clean' || s.status === 'findings' || s.status === 'error',
  )
  const errors = terminal.filter((s) => s.status === 'error').length
  const lastSuccess =
    window.find((s) => (s.status === 'clean' || s.status === 'findings') && s.scanned_at) ?? null
  const lastError = window.find((s) => s.status === 'error') ?? null
  return {
    lastSuccess,
    lastError,
    errorRatePct: terminal.length === 0 ? 0 : Math.round((errors / terminal.length) * 100),
    windowSize: terminal.length,
  }
}

const SecurityScanningPage: React.FC = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { allowedScopes } = useAuth()
  const isAdmin = allowedScopes.includes('admin')
  const {
    data: config,
    isLoading: configLoading,
    error: configError,
  } = useQuery({
    queryKey: ['scanning', 'config'],
    queryFn: () => api.getScanningConfig(),
  })

  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(20)

  const [scannerSuccess, setScannerSuccess] = useState<string | null>(null)
  const [scannerError, setScannerError] = useState<string | null>(null)
  const [scannerVersionInput, setScannerVersionInput] = useState('')
  const [scannerActivate, setScannerActivate] = useState(true)
  const [scannerLatest, setScannerLatest] = useState<ScannerLatestInfo | null>(null)
  const [configExpanded, setConfigExpanded] = useState(true)
  const [scannerMgmtExpanded, setScannerMgmtExpanded] = useState(true)

  const checkLatestMutation = useMutation({
    mutationFn: () => api.checkScannerLatest(config!.tool),
    onSuccess: (data) => {
      setScannerLatest(data)
      setScannerError(null)
    },
    onError: (err: unknown) => {
      setScannerError(getErrorMessage(err, t('admin.securityScanning.scanner.checkError')))
    },
  })

  const installMutation = useMutation({
    mutationFn: () =>
      api.adminInstallScanner({
        tool: config!.tool,
        version: scannerVersionInput || undefined,
        activate: scannerActivate,
      }),
    onSuccess: (data) => {
      setScannerSuccess(
        t('admin.securityScanning.scanner.installSuccess', {
          version: data.version,
          path: data.binary_path,
        }),
      )
      setScannerError(null)
      queryClient.invalidateQueries({ queryKey: ['scanning'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.scanner._def })
    },
    onError: (err: unknown) => {
      setScannerError(getErrorMessage(err, t('admin.securityScanning.scanner.installError')))
    },
  })

  const triggerCheckMutation = useMutation({
    mutationFn: () => api.triggerScannerCheck(),
    onSuccess: () => {
      setScannerSuccess(t('admin.securityScanning.scanner.checkQueued'))
      setScannerError(null)
    },
    onError: (err: unknown) => {
      setScannerError(getErrorMessage(err, t('admin.securityScanning.scanner.checkError')))
    },
  })

  const [autoUpdateForm, setAutoUpdateForm] = useState<ScannerAutoUpdateInput>({
    enabled: false,
    interval_hours: 24,
    requires_approval: true,
    auto_approve_rules: '',
  })

  useEffect(() => {
    if (config?.auto_update) {
      setAutoUpdateForm({
        enabled: config.auto_update.enabled,
        interval_hours: config.auto_update.interval_hours,
        requires_approval: config.auto_update.requires_approval,
        auto_approve_rules: config.auto_update.auto_approve_rules ?? '',
      })
    }
  }, [config?.auto_update])

  const autoApproveRulesTrimmed = autoUpdateForm.auto_approve_rules.trim()
  let autoUpdateRulesInvalid = false
  if (autoApproveRulesTrimmed !== '') {
    try {
      JSON.parse(autoApproveRulesTrimmed)
    } catch {
      autoUpdateRulesInvalid = true
    }
  }

  const saveAutoUpdateMutation = useMutation({
    mutationFn: () => api.saveScannerAutoUpdate(autoUpdateForm),
    onSuccess: () => {
      setScannerSuccess(t('admin.securityScanning.scanner.autoUpdate.saveSuccess'))
      setScannerError(null)
      queryClient.invalidateQueries({ queryKey: ['scanning'] })
    },
    onError: (err: unknown) => {
      setScannerError(
        getErrorMessage(err, t('admin.securityScanning.scanner.autoUpdate.saveError')),
      )
    },
  })

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ['scanning', 'stats', statusFilter, page, rowsPerPage],
    queryFn: () =>
      api.getScanningStats({
        status: statusFilter,
        limit: rowsPerPage,
        offset: page * rowsPerPage,
      }),
  })

  const [expandedScanId, setExpandedScanId] = useState<string | null>(null)
  const [findingsModalOpen, setFindingsModalOpen] = useState(false)
  const [findingsModalScan, setFindingsModalScan] = useState<ModuleScan | null>(null)
  const [findingsModalLoading, setFindingsModalLoading] = useState(false)
  const [findingsModalLabel, setFindingsModalLabel] = useState('')

  const handleFindingsClick = async (scan: RecentScanEntry) => {
    setFindingsModalLabel(
      `${scan.namespace}/${scan.module_name}/${scan.system} v${scan.module_version}`,
    )
    setFindingsModalScan(null)
    setFindingsModalLoading(true)
    setFindingsModalOpen(true)
    try {
      const full = await api.getScanByID(scan.id)
      setFindingsModalScan(full)
    } catch {
      // Fallback: try the module version endpoint
      try {
        const full = await api.getModuleScan(
          scan.namespace,
          scan.module_name,
          scan.system,
          scan.module_version,
        )
        setFindingsModalScan(full)
      } catch {
        // Leave scan null — modal will show "no data" message
      }
    } finally {
      setFindingsModalLoading(false)
    }
  }

  const health = useMemo(
    () => computeScannerHealth(stats?.recent_scans ?? []),
    [stats?.recent_scans],
  )

  const loading = configLoading || statsLoading
  const error = configError || statsError

  return (
    <Page maxWidth="lg">
      <PageHeader
        icon={<PageTitleIcon />}
        title={t('admin.securityScanning.pageTitle')}
        description={t('admin.securityScanning.pageSubtitle')}
      />
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{t('admin.securityScanning.loadError')}</Alert>
      ) : (
        <>
          {/* Configuration */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box
              role="button"
              tabIndex={0}
              aria-expanded={configExpanded}
              onClick={() => setConfigExpanded((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setConfigExpanded((v) => !v)
                }
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <Typography variant="h6">{t('admin.securityScanning.configuration')}</Typography>
              {configExpanded ? <KeyboardArrowDown /> : <KeyboardArrowRight />}
            </Box>
            <Collapse in={configExpanded} timeout="auto">
              <Divider sx={{ mb: 2, mt: 1 }} />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {t('admin.securityScanning.status')}
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      icon={config?.enabled ? <CheckCircle /> : <Error />}
                      label={
                        config?.enabled
                          ? t('admin.securityScanning.enabled')
                          : t('admin.securityScanning.disabled')
                      }
                      color={config?.enabled ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {t('admin.securityScanning.scannerTool')}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      fontFamily: 'monospace',
                    }}
                  >
                    {config?.tool || '—'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {t('admin.securityScanning.expectedVersion')}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      fontFamily: 'monospace',
                    }}
                  >
                    {config?.expected_version || t('admin.securityScanning.notPinned')}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {t('admin.securityScanning.severityThreshold')}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      fontFamily: 'monospace',
                    }}
                  >
                    {config?.severity_threshold || '—'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {t('admin.securityScanning.timeout')}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      fontFamily: 'monospace',
                    }}
                  >
                    {config?.timeout || '—'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {t('admin.securityScanning.workersInterval')}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      fontFamily: 'monospace',
                    }}
                  >
                    {t('admin.securityScanning.workersValue', {
                      workers: config?.worker_count ?? '—',
                      mins: config?.scan_interval_mins ?? '—',
                    })}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {t('admin.securityScanning.binaryPath')}
                  </Typography>
                  {config?.binary_path ? (
                    <Typography
                      variant="body1"
                      sx={{
                        fontFamily: 'monospace',
                        wordBreak: 'break-all',
                      }}
                    >
                      {config.binary_path}
                    </Typography>
                  ) : (
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.disabled',
                      }}
                    >
                      {t('admin.securityScanning.notReported')}
                    </Typography>
                  )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {t('admin.securityScanning.detectedVersion')}
                  </Typography>
                  {config?.detected_version ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                      <Typography
                        variant="body1"
                        sx={{
                          fontFamily: 'monospace',
                        }}
                      >
                        {config.detected_version}
                      </Typography>
                      {config.expected_version &&
                        config.detected_version !== config.expected_version && (
                          <Tooltip
                            title={t('admin.securityScanning.expectedTooltip', {
                              version: config.expected_version,
                            })}
                          >
                            <WarningAmber fontSize="small" color="warning" />
                          </Tooltip>
                        )}
                    </Box>
                  ) : (
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.disabled',
                      }}
                    >
                      {t('admin.securityScanning.notReported')}
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </Collapse>
          </Paper>

          {/* Scanner Tool Management */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box
              role="button"
              tabIndex={0}
              aria-expanded={scannerMgmtExpanded}
              onClick={() => setScannerMgmtExpanded((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setScannerMgmtExpanded((v) => !v)
                }
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <Typography variant="h6">{t('admin.securityScanning.scanner.title')}</Typography>
              {scannerMgmtExpanded ? <KeyboardArrowDown /> : <KeyboardArrowRight />}
            </Box>
            <Collapse in={scannerMgmtExpanded} timeout="auto">
              <Divider sx={{ mb: 2, mt: 1 }} />
              {scannerSuccess && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setScannerSuccess(null)}>
                  {scannerSuccess}
                </Alert>
              )}
              {scannerError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setScannerError(null)}>
                  {scannerError}
                </Alert>
              )}
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
                <Button
                  variant="outlined"
                  disabled={!isAdmin || !config?.tool || checkLatestMutation.isPending}
                  onClick={() => checkLatestMutation.mutate()}
                >
                  {checkLatestMutation.isPending ? (
                    <CircularProgress size={20} />
                  ) : (
                    t('admin.securityScanning.scanner.checkForUpdates')
                  )}
                </Button>
                {scannerLatest && (
                  <>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {t('admin.securityScanning.scanner.currentVersion')}:{' '}
                      <strong>{scannerLatest.current_version || '—'}</strong>{' '}
                      {t('admin.securityScanning.scanner.latestVersion')}:{' '}
                      <strong>{scannerLatest.latest_version}</strong>
                    </Typography>
                    <Chip
                      label={
                        scannerLatest.update_available
                          ? t('admin.securityScanning.scanner.updateAvailable')
                          : t('admin.securityScanning.scanner.upToDate')
                      }
                      color={scannerLatest.update_available ? 'warning' : 'success'}
                      size="small"
                      variant="outlined"
                    />
                    {scannerLatest.signature_supported && (
                      <Tooltip title={t('admin.securityScanning.scanner.signatureSupported')}>
                        <CheckCircle fontSize="small" color="success" />
                      </Tooltip>
                    )}
                  </>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
                <TextField
                  label={t('admin.securityScanning.scanner.versionOptional')}
                  size="small"
                  value={scannerVersionInput}
                  onChange={(e) => setScannerVersionInput(e.target.value)}
                  disabled={!isAdmin}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={scannerActivate}
                      onChange={(e) => setScannerActivate(e.target.checked)}
                      disabled={!isAdmin}
                    />
                  }
                  label={t('admin.securityScanning.scanner.activateNow')}
                />
                <Button
                  variant="contained"
                  disabled={!isAdmin || !config?.tool || installMutation.isPending}
                  onClick={() => installMutation.mutate()}
                >
                  {installMutation.isPending ? (
                    <CircularProgress size={20} />
                  ) : (
                    t('admin.securityScanning.scanner.installAndActivate')
                  )}
                </Button>
                <Button
                  variant="text"
                  disabled={!isAdmin || triggerCheckMutation.isPending}
                  onClick={() => triggerCheckMutation.mutate()}
                >
                  {triggerCheckMutation.isPending ? (
                    <CircularProgress size={20} />
                  ) : (
                    t('admin.securityScanning.scanner.install')
                  )}
                </Button>
              </Box>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                {t('admin.securityScanning.scanner.autoUpdate.title')}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                {t('admin.securityScanning.scanner.autoUpdate.description')}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 480 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoUpdateForm.enabled}
                      onChange={(e) =>
                        setAutoUpdateForm({ ...autoUpdateForm, enabled: e.target.checked })
                      }
                      disabled={!isAdmin}
                    />
                  }
                  label={t('admin.securityScanning.scanner.autoUpdate.enabled')}
                />
                <TextField
                  label={t('admin.securityScanning.scanner.autoUpdate.intervalHours')}
                  type="number"
                  value={autoUpdateForm.interval_hours}
                  onChange={(e) =>
                    setAutoUpdateForm({
                      ...autoUpdateForm,
                      interval_hours: parseInt(e.target.value) || 24,
                    })
                  }
                  disabled={!isAdmin}
                  slotProps={{
                    htmlInput: { min: 1 },
                  }}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoUpdateForm.requires_approval}
                      onChange={(e) =>
                        setAutoUpdateForm({
                          ...autoUpdateForm,
                          requires_approval: e.target.checked,
                        })
                      }
                      disabled={!isAdmin}
                    />
                  }
                  label={t('admin.securityScanning.scanner.autoUpdate.requiresApproval')}
                />
                <TextField
                  label={t('admin.securityScanning.scanner.autoUpdate.autoApproveRules')}
                  multiline
                  minRows={3}
                  value={autoUpdateForm.auto_approve_rules}
                  onChange={(e) =>
                    setAutoUpdateForm({ ...autoUpdateForm, auto_approve_rules: e.target.value })
                  }
                  error={autoUpdateRulesInvalid}
                  helperText={
                    autoUpdateRulesInvalid
                      ? t('admin.securityScanning.scanner.autoUpdate.autoApproveRulesInvalid')
                      : t('admin.securityScanning.scanner.autoUpdate.autoApproveRulesHelp')
                  }
                  disabled={!isAdmin}
                />
                <Box>
                  <Button
                    variant="contained"
                    disabled={
                      !isAdmin || autoUpdateRulesInvalid || saveAutoUpdateMutation.isPending
                    }
                    onClick={() => saveAutoUpdateMutation.mutate()}
                  >
                    {saveAutoUpdateMutation.isPending ? (
                      <CircularProgress size={20} />
                    ) : (
                      t('admin.securityScanning.scanner.autoUpdate.save')
                    )}
                  </Button>
                </Box>
              </Box>
            </Collapse>
          </Paper>

          {/* Summary Stats */}
          {stats && (
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
              {[
                {
                  testId: 'total-scans',
                  label: t('admin.securityScanning.totalScans'),
                  value: stats.total,
                  icon: <CheckCircle fontSize="small" />,
                  color: undefined as string | undefined,
                  filterValue: undefined as string | undefined,
                },
                {
                  testId: 'pending',
                  label: t('admin.securityScanning.statusPending'),
                  value: stats.pending,
                  icon: <HourglassEmpty fontSize="small" />,
                  color: undefined as string | undefined,
                  filterValue: 'pending',
                },
                {
                  testId: 'clean',
                  label: t('admin.securityScanning.statusClean'),
                  value: stats.clean,
                  color: 'success.main',
                  filterValue: 'clean',
                },
                {
                  testId: 'findings',
                  label: t('admin.securityScanning.statusFindings'),
                  value: stats.findings,
                  color: 'warning.main',
                  filterValue: 'findings',
                },
                {
                  testId: 'errors',
                  label: t('admin.securityScanning.errors'),
                  value: stats.error,
                  color: 'error.main',
                  filterValue: 'error',
                },
              ].map((item) => (
                <Paper
                  key={item.label}
                  sx={{
                    px: 2,
                    py: 1.5,
                    flex: 1,
                    minWidth: 120,
                    cursor: 'pointer',
                    outline:
                      statusFilter === item.filterValue
                        ? '2px solid'
                        : statusFilter === undefined && item.filterValue === undefined
                          ? '2px solid'
                          : 'none',
                    outlineColor: 'primary.main',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                  onClick={() => {
                    setStatusFilter(item.filterValue)
                    setPage(0)
                  }}
                  data-testid={`stat-card-${item.testId}`}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {item.label}
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 700,
                      color: item.color,
                    }}
                  >
                    {item.value}
                  </Typography>
                </Paper>
              ))}
            </Box>
          )}

          {/* Scanner Health */}
          {stats && stats.recent_scans.length > 0 && (
            <Paper sx={{ p: 3, mb: 3 }} data-testid="scanner-health">
              <Typography variant="h6" gutterBottom>
                {t('admin.securityScanning.scannerHealth')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {t('admin.securityScanning.lastSuccessfulScan')}
                  </Typography>
                  {health.lastSuccess?.scanned_at ? (
                    <Tooltip title={new Date(health.lastSuccess.scanned_at).toLocaleString()}>
                      <Typography variant="body1">
                        {timeAgo(t, health.lastSuccess.scanned_at)}
                      </Typography>
                    </Tooltip>
                  ) : (
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.disabled',
                      }}
                    >
                      {t('admin.securityScanning.noSuccessfulScans')}
                    </Typography>
                  )}
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {t('admin.securityScanning.errorRate', { count: health.windowSize || 0 })}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                    <Typography
                      variant="h6"
                      sx={{ color: health.errorRatePct > 0 ? 'error.main' : 'success.main' }}
                    >
                      {health.errorRatePct}%
                    </Typography>
                    {health.errorRatePct > 0 && <WarningAmber fontSize="small" color="warning" />}
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {t('admin.securityScanning.lastErrorLabel')}
                  </Typography>
                  {health.lastError ? (
                    <Box>
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{
                          fontFamily: 'monospace',
                        }}
                      >
                        {health.lastError.namespace}/{health.lastError.module_name}/
                        {health.lastError.system}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                        }}
                      >
                        {health.lastError.scanned_at
                          ? timeAgo(t, health.lastError.scanned_at)
                          : timeAgo(t, health.lastError.created_at)}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'success.main',
                      }}
                    >
                      {t('admin.securityScanning.noErrorsInWindow')}
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </Paper>
          )}

          {/* Recent Scans */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('admin.securityScanning.recentScans')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {!stats?.recent_scans?.length ? (
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {t('admin.securityScanning.noScansYet')}
              </Typography>
            ) : (
              <>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 40 }} />
                        <TableCell>{t('admin.securityScanning.thModule')}</TableCell>
                        <TableCell>{t('admin.securityScanning.thVersion')}</TableCell>
                        <TableCell>{t('admin.securityScanning.thScanner')}</TableCell>
                        <TableCell>{t('admin.securityScanning.thStatus')}</TableCell>
                        <TableCell align="right">
                          {t('admin.securityScanning.thCritical')}
                        </TableCell>
                        <TableCell align="right">{t('admin.securityScanning.thHigh')}</TableCell>
                        <TableCell align="right">{t('admin.securityScanning.thMedium')}</TableCell>
                        <TableCell align="right">{t('admin.securityScanning.thLow')}</TableCell>
                        <TableCell align="right">{t('admin.securityScanning.thWhen')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.recent_scans.map((scan) => {
                        const hasDiagnostics =
                          Boolean(scan.error_message) || Boolean(scan.execution_log)
                        const isExpanded = expandedScanId === scan.id
                        return (
                          <React.Fragment key={scan.id}>
                            <TableRow hover>
                              <TableCell sx={{ p: 0.5 }}>
                                {hasDiagnostics && (
                                  <IconButton
                                    size="small"
                                    aria-label={
                                      isExpanded
                                        ? t('admin.securityScanning.hideScanDetails')
                                        : t('admin.securityScanning.showScanDetails')
                                    }
                                    onClick={() => setExpandedScanId(isExpanded ? null : scan.id)}
                                    data-testid={`scan-row-toggle-${scan.id}`}
                                  >
                                    {isExpanded ? <KeyboardArrowDown /> : <KeyboardArrowRight />}
                                  </IconButton>
                                )}
                              </TableCell>
                              <TableCell>
                                <Typography
                                  variant="body2"
                                  noWrap
                                  sx={{
                                    fontFamily: 'monospace',
                                  }}
                                >
                                  {scan.namespace}/{scan.module_name}/{scan.system}
                                </Typography>
                              </TableCell>
                              <TableCell>{scan.module_version}</TableCell>
                              <TableCell>{scan.scanner}</TableCell>
                              <TableCell>
                                {statusChip(
                                  t,
                                  scan.status,
                                  scan.status === 'findings'
                                    ? () => handleFindingsClick(scan)
                                    : undefined,
                                )}
                              </TableCell>
                              <TableCell align="right">{scan.critical_count}</TableCell>
                              <TableCell align="right">{scan.high_count}</TableCell>
                              <TableCell align="right">{scan.medium_count}</TableCell>
                              <TableCell align="right">{scan.low_count}</TableCell>
                              <TableCell align="right">
                                <Tooltip
                                  title={
                                    scan.scanned_at
                                      ? new Date(scan.scanned_at).toLocaleString()
                                      : t('admin.securityScanning.notScannedYet')
                                  }
                                >
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: 'text.secondary',
                                    }}
                                  >
                                    {scan.scanned_at ? timeAgo(t, scan.scanned_at) : '—'}
                                  </Typography>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                            {hasDiagnostics && (
                              <TableRow>
                                <TableCell colSpan={10} sx={{ py: 0, border: 0 }}>
                                  <Collapse in={isExpanded} unmountOnExit>
                                    <Box sx={{ py: 2, px: 1 }}>
                                      <ScanDiagnostics
                                        errorMessage={scan.error_message}
                                        executionLog={scan.execution_log}
                                      />
                                    </Box>
                                  </Collapse>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={stats.total_filtered}
                  page={page}
                  onPageChange={(_, newPage) => setPage(newPage)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10))
                    setPage(0)
                  }}
                  rowsPerPageOptions={[10, 20, 50, 100]}
                />
              </>
            )}
          </Paper>
        </>
      )}
      <ScanFindingsModal
        open={findingsModalOpen}
        onClose={() => setFindingsModalOpen(false)}
        scan={findingsModalScan}
        loading={findingsModalLoading}
        moduleLabel={findingsModalLabel}
      />
    </Page>
  )
}

export default SecurityScanningPage
