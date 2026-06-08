import React, { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  SelectChangeEvent,
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import HistoryIcon from '@mui/icons-material/History'
import EmptyState from '../../components/EmptyState'
import Page from '../../components/Page'
import api from '../../services/api'
import { AuditLog } from '../../types'
import { queryKeys } from '../../services/queryKeys'

const RESOURCE_TYPES = [
  { value: '', label: 'All Resource Types' },
  { value: 'module', label: 'Module' },
  { value: 'provider', label: 'Provider' },
  { value: 'terraform_binary', label: 'Terraform Binary' },
  { value: 'file', label: 'File' },
  { value: 'user', label: 'User' },
  { value: 'mirror', label: 'Mirror' },
  { value: 'api_key', label: 'API Key' },
  { value: 'organization', label: 'Organization' },
]

const AuditLogPage: React.FC = () => {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)

  // Pagination (MUI TablePagination uses 0-based page)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)

  // Filters
  const [resourceType, setResourceType] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [userEmailFilter, setUserEmailFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Debounced values for text inputs
  const [debouncedAction, setDebouncedAction] = useState('')
  const [debouncedUserEmail, setDebouncedUserEmail] = useState('')
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Detail dialog
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Export menu
  const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null)

  const queryParams = {
    page: page + 1,
    per_page: rowsPerPage,
    ...(resourceType ? { resource_type: resourceType } : {}),
    ...(debouncedAction ? { action: debouncedAction } : {}),
    ...(debouncedUserEmail ? { user_email: debouncedUserEmail } : {}),
    ...(startDate ? { start_date: new Date(startDate).toISOString() } : {}),
    ...(endDate ? { end_date: new Date(endDate).toISOString() } : {}),
  }

  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.auditLogs.list(queryParams),
    queryFn: () => api.listAuditLogs(queryParams),
  })

  const logs = data?.logs ?? []
  const total = data?.pagination?.total ?? 0

  if (queryError && !error) {
    setError(queryError instanceof Error ? queryError.message : 'Failed to load audit logs')
  }

  // Debounce text filter changes
  const handleActionChange = (value: string) => {
    setActionFilter(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setDebouncedAction(value)
      setPage(0)
    }, 400)
  }

  const handleUserEmailChange = (value: string) => {
    setUserEmailFilter(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setDebouncedUserEmail(value)
      setPage(0)
    }, 400)
  }

  const handleResourceTypeChange = (e: SelectChangeEvent) => {
    setResourceType(e.target.value)
    setPage(0)
  }

  const handleStartDateChange = (value: string) => {
    setStartDate(value)
    setPage(0)
  }

  const handleEndDateChange = (value: string) => {
    setEndDate(value)
    setPage(0)
  }

  const handleResetFilters = () => {
    setResourceType('')
    setActionFilter('')
    setDebouncedAction('')
    setUserEmailFilter('')
    setDebouncedUserEmail('')
    setStartDate('')
    setEndDate('')
    setPage(0)
  }

  const handleRowClick = (log: AuditLog) => {
    setSelectedLog(log)
    setDetailOpen(true)
  }

  const handleExportCSV = async () => {
    setExportAnchor(null)
    try {
      const result = await api.listAuditLogs({
        per_page: 1000,
        ...(resourceType ? { resource_type: resourceType } : {}),
        ...(debouncedAction ? { action: debouncedAction } : {}),
        ...(debouncedUserEmail ? { user_email: debouncedUserEmail } : {}),
        ...(startDate ? { start_date: new Date(startDate).toISOString() } : {}),
        ...(endDate ? { end_date: new Date(endDate).toISOString() } : {}),
      })
      api.exportAuditLogsCSV(result.logs ?? [])
    } catch {
      setError('Failed to export audit logs')
    }
  }

  const handleExportJSON = async () => {
    setExportAnchor(null)
    try {
      const result = await api.listAuditLogs({
        per_page: 1000,
        ...(resourceType ? { resource_type: resourceType } : {}),
        ...(debouncedAction ? { action: debouncedAction } : {}),
        ...(debouncedUserEmail ? { user_email: debouncedUserEmail } : {}),
        ...(startDate ? { start_date: new Date(startDate).toISOString() } : {}),
        ...(endDate ? { end_date: new Date(endDate).toISOString() } : {}),
      })
      api.exportAuditLogsJSON(result.logs ?? [])
    } catch {
      setError('Failed to export audit logs')
    }
  }

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString()
    } catch {
      return ts
    }
  }

  return (
    <Page maxWidth="lg" aria-busy={loading} aria-live="polite">
      {/* Header */}
      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Audit Logs
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            Track system activity across all resources and users
          </Typography>
        </Box>
        <Box>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={(e) => setExportAnchor(e.currentTarget)}
          >
            Export
          </Button>
          <Menu
            anchorEl={exportAnchor}
            open={Boolean(exportAnchor)}
            onClose={() => setExportAnchor(null)}
          >
            <MenuItem onClick={handleExportCSV}>{t('admin.auditLog.exportCsv')}</MenuItem>
            <MenuItem onClick={handleExportJSON}>{t('admin.auditLog.exportJson')}</MenuItem>
          </Menu>
        </Box>
      </Box>
      {/* Filter Bar */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <TextField
            label={t('admin.auditLog.labelStartDate')}
            type="datetime-local"
            size="small"
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            sx={{ minWidth: 200 }}
            slotProps={{
              inputLabel: { shrink: true },
            }}
          />
          <TextField
            label={t('admin.auditLog.labelEndDate')}
            type="datetime-local"
            size="small"
            value={endDate}
            onChange={(e) => handleEndDateChange(e.target.value)}
            sx={{ minWidth: 200 }}
            slotProps={{
              inputLabel: { shrink: true },
            }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="resource-type-label">
              {t('admin.auditLog.labelResourceType')}
            </InputLabel>
            <Select
              labelId="resource-type-label"
              value={resourceType}
              label={t('admin.auditLog.labelResourceType')}
              onChange={handleResourceTypeChange}
              inputProps={{ 'data-testid': 'resource-type-select' }}
            >
              {RESOURCE_TYPES.map((rt) => (
                <MenuItem key={rt.value} value={rt.value}>
                  {rt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label={t('admin.auditLog.labelAction')}
            size="small"
            placeholder="e.g. POST /api/v1/modules"
            value={actionFilter}
            onChange={(e) => handleActionChange(e.target.value)}
            sx={{ minWidth: 220 }}
          />
          <TextField
            label={t('admin.auditLog.labelUserEmail')}
            size="small"
            placeholder={t('admin.auditLog.placeholderUserEmail')}
            value={userEmailFilter}
            onChange={(e) => handleUserEmailChange(e.target.value)}
            sx={{ minWidth: 200 }}
          />
          <Button variant="text" onClick={handleResetFilters}>
            Reset
          </Button>
        </Box>
      </Paper>
      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {/* Table */}
      <Paper>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>
                      {t('admin.auditLog.thTimestamp')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('admin.auditLog.thAction')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('admin.auditLog.thResource')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('admin.auditLog.thUser')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>
                      {t('admin.auditLog.thIpAddress')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ p: 0, border: 0 }}>
                        <EmptyState
                          title={t('admin.auditLog.emptyTitle')}
                          description={t('admin.auditLog.emptySubtitle')}
                          icon={<HistoryIcon />}
                          data-testid="audit-log-empty-state"
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow
                        key={log.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => handleRowClick(log)}
                      >
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {formatTimestamp(log.created_at)}
                        </TableCell>
                        <TableCell
                          sx={{
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {log.action}
                        </TableCell>
                        <TableCell>{log.resource_type ?? '—'}</TableCell>
                        <TableCell>
                          {log.user_email ?? log.user_name ?? log.user_id ?? '—'}
                        </TableCell>
                        <TableCell>{log.ip_address ?? '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_e, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10))
                setPage(0)
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </>
        )}
      </Paper>
      {/* Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('admin.auditLog.detailTitle')}</DialogTitle>
        <DialogContent dividers>
          {selectedLog && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    ID
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
                  >
                    {selectedLog.id}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    Timestamp
                  </Typography>
                  <Typography variant="body2">{formatTimestamp(selectedLog.created_at)}</Typography>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    Action
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {selectedLog.action}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    Resource Type
                  </Typography>
                  <Typography variant="body2">{selectedLog.resource_type ?? '—'}</Typography>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    Resource ID
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
                  >
                    {selectedLog.resource_id ?? '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    IP Address
                  </Typography>
                  <Typography variant="body2">{selectedLog.ip_address ?? '—'}</Typography>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    User
                  </Typography>
                  <Typography variant="body2">
                    {selectedLog.user_email
                      ? `${selectedLog.user_email}${selectedLog.user_name ? ` (${selectedLog.user_name})` : ''}`
                      : (selectedLog.user_id ?? '—')}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    Organization ID
                  </Typography>
                  <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                    {selectedLog.organization_id ?? '—'}
                  </Typography>
                </Box>
              </Box>
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    Metadata
                  </Typography>
                  <Paper variant="outlined" sx={{ mt: 0.5, p: 1.5, bgcolor: 'grey.50' }}>
                    <pre
                      style={{
                        margin: 0,
                        fontSize: '0.8rem',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>{t('admin.auditLog.close')}</Button>
        </DialogActions>
      </Dialog>
    </Page>
  )
}

export default AuditLogPage
