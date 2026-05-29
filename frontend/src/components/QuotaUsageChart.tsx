import React from 'react'
import { useTranslation } from 'react-i18next'
import { Box, LinearProgress, Typography, Tooltip, Paper } from '@mui/material'
import { OrgQuota } from '../types'

interface QuotaRowProps {
  label: string
  used: number
  limit: number
  ratio: number
  formatUsed: (v: number) => string
  formatLimit: (v: number) => string
}

function QuotaRow({ label, used, limit, ratio, formatUsed, formatLimit }: QuotaRowProps) {
  const unlimited = limit === 0
  const pct = unlimited ? 0 : Math.min(ratio * 100, 100)
  const isWarning = !unlimited && ratio >= 0.8 && ratio < 1.0
  const isError = !unlimited && ratio >= 1.0
  const color = isError ? 'error' : isWarning ? 'warning' : 'primary'

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
          }}
        >
          {unlimited ? (
            <Box component="span" sx={{ color: 'text.secondary' }}>
              {formatUsed(used)} / Unlimited
            </Box>
          ) : (
            <Box
              component="span"
              sx={{ color: isError ? 'error.main' : isWarning ? 'warning.main' : 'text.primary' }}
            >
              {formatUsed(used)} / {formatLimit(limit)}
            </Box>
          )}
        </Typography>
      </Box>
      <Tooltip title={unlimited ? 'No limit configured' : `${pct.toFixed(1)}% utilization`}>
        <LinearProgress
          variant="determinate"
          value={pct}
          color={color}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Tooltip>
    </Box>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

interface QuotaUsageChartProps {
  quota: OrgQuota
  orgName?: string
}

const QuotaUsageChart: React.FC<QuotaUsageChartProps> = ({ quota, orgName }) => {
  const { t } = useTranslation()
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      {orgName && (
        <Typography
          variant="subtitle2"
          gutterBottom
          sx={{
            fontWeight: 600,
          }}
        >
          {orgName}
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <QuotaRow
          label={t('quotaUsageChart.storage')}
          used={quota.storage_bytes_used}
          limit={quota.storage_bytes_limit}
          ratio={quota.storage_utilization_ratio}
          formatUsed={formatBytes}
          formatLimit={formatBytes}
        />
        <QuotaRow
          label={t('quotaUsageChart.publishesPerDay')}
          used={quota.publishes_today}
          limit={quota.publishes_per_day_limit}
          ratio={quota.publish_utilization_ratio}
          formatUsed={(v) => String(v)}
          formatLimit={(v) => String(v)}
        />
        <QuotaRow
          label={t('quotaUsageChart.downloadsPerDay')}
          used={quota.downloads_today}
          limit={quota.downloads_per_day_limit}
          ratio={quota.download_utilization_ratio}
          formatUsed={(v) => String(v)}
          formatLimit={(v) => String(v)}
        />
      </Box>
    </Paper>
  )
}

export default QuotaUsageChart
