import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import WarningIcon from '@mui/icons-material/Warning'
import HelpOutlineIcon from '@mui/icons-material/HelpOutlined'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useReleasesGPGKeyStatus } from '../hooks/useReleasesGPGKeyStatus'
import type { ReleasesGPGKeyStatus, ReleasesGPGKeyStatusView } from '../types/releases_gpg_keys'

function statusColor(status: ReleasesGPGKeyStatus): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case 'ok':
      return 'success'
    case 'warn':
      return 'warning'
    case 'expired':
      return 'error'
    default:
      return 'default'
  }
}

function StatusIcon({ status }: { status: ReleasesGPGKeyStatus }) {
  switch (status) {
    case 'ok':
      return <CheckCircleIcon fontSize="small" color="success" />
    case 'warn':
      return <WarningIcon fontSize="small" color="warning" />
    case 'expired':
      return <ErrorIcon fontSize="small" color="error" />
    default:
      return <HelpOutlineIcon fontSize="small" color="disabled" />
  }
}

function formatExpiry(t: TFunction, days: number | null | undefined): string {
  if (days == null) return '—'
  if (days < 0) return t('releasesGpgKeys.expiredAgo', { days: Math.abs(days) })
  return t('releasesGpgKeys.days', { days })
}

function KeyRow({ row }: { row: ReleasesGPGKeyStatusView }) {
  const { t } = useTranslation()
  const effective = row.effective_source === 'cache' && row.cache ? row.cache : row.embedded
  const fingerprint = effective?.fingerprint ?? '—'
  const daysUntilExpiry = effective?.days_until_expiry

  return (
    <TableRow>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StatusIcon status={row.status} />
          <Chip
            label={row.tool}
            size="small"
            color={row.tool === 'terraform' ? 'primary' : 'secondary'}
            variant="outlined"
          />
        </Box>
      </TableCell>
      <TableCell>
        <Chip label={row.status} size="small" color={statusColor(row.status)} />
      </TableCell>
      <TableCell>
        <Chip label={row.effective_source} size="small" variant="outlined" />
      </TableCell>
      <TableCell>
        <Tooltip title={fingerprint}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
            {fingerprint.length > 16
              ? `${fingerprint.slice(0, 8)}…${fingerprint.slice(-8)}`
              : fingerprint}
          </Typography>
        </Tooltip>
      </TableCell>
      <TableCell>
        <Typography
          variant="body2"
          color={
            daysUntilExpiry != null && daysUntilExpiry < 0
              ? 'error'
              : daysUntilExpiry != null && daysUntilExpiry < row.expiry_warning_days
                ? 'warning.main'
                : 'text.primary'
          }
        >
          {formatExpiry(t, daysUntilExpiry)}
        </Typography>
      </TableCell>
      <TableCell>
        {row.cache ? (
          <Tooltip title={row.cache.source_url}>
            <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
              {new Date(row.cache.fetched_at).toLocaleString()}
            </Typography>
          </Tooltip>
        ) : (
          <Typography variant="body2" color="text.secondary">
            —
          </Typography>
        )}
      </TableCell>
    </TableRow>
  )
}

export default function ReleasesGPGKeyStatus() {
  const { t } = useTranslation()
  const { data, isLoading, error } = useReleasesGPGKeyStatus()

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        {t('releasesGpgKeys.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('releasesGpgKeys.description')}
      </Typography>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : error ? (
        <Alert severity="error">{t('releasesGpgKeys.loadError')}</Alert>
      ) : data && data.keys.length > 0 ? (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('releasesGpgKeys.thTool')}</TableCell>
                <TableCell>{t('releasesGpgKeys.thStatus')}</TableCell>
                <TableCell>{t('releasesGpgKeys.thSource')}</TableCell>
                <TableCell>{t('releasesGpgKeys.thFingerprint')}</TableCell>
                <TableCell>{t('releasesGpgKeys.thExpiry')}</TableCell>
                <TableCell>{t('releasesGpgKeys.thLastRefresh')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.keys.map((key) => (
                <KeyRow key={key.tool} row={key} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Alert severity="info">{t('releasesGpgKeys.noData')}</Alert>
      )}
    </Paper>
  )
}
