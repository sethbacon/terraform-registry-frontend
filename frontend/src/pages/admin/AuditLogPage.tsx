import React, { useMemo, useState, useRef } from 'react'
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
import PageHeader from '../../components/PageHeader'
import StatusAlerts from '../../components/StatusAlerts'
import PageTitleIcon from '@mui/icons-material/History'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { useStatusMessage } from '../../hooks/useStatusMessage'
import { AuditLog } from '../../types'
import { queryKeys } from '../../services/queryKeys'
import { usePagination } from '../../hooks/usePagination'
import { getErrorMessage, getErrorStatus } from '../../utils/errors'

const RESOURCE_TYPES = [
  { value: '', label: 'All Resource Types' },
  { value: 'module', label: 'Module' },
  { value: 'provider', label: 'Provider' },
  { value: 'terraform_binary', label: 'Terraform Binary' },
  // Hosted binary mirror configs. The backend still emits the legacy
  // 'terraform_mirror' resource type; surface it consistently as "Binary Mirror".
  { value: 'terraform_mirror', label: 'Binary Mirror' },
  { value: 'file', label: 'File' },
  { value: 'user', label: 'User' },
  { value: 'mirror', label: 'Mirror' },
  { value: 'api_key', label: 'API Key' },
  { value: 'organization', label: 'Organization' },
]

// Maps a raw audit resource_type to its display label (falling back to the raw
// value for unknown types) so the table column matches the filter dropdown.
const resourceTypeLabel = (value: string | null | undefined): string => {
  if (!value) return '—'
  return RESOURCE_TYPES.find((rt) => rt.value === value)?.label ?? value
}

// The "no organization filter" option value. Empty string rather than a
// sentinel id: it is the MUI Select's own "nothing selected" value, and it must
// mean "everything this caller may see" — never "some default organization".
// Platform admins deliberately read the whole estate here, so defaulting the
// filter to an organization would quietly hide the rest of it.
const ALL_ORGANIZATIONS = ''

const AuditLogPage: React.FC = () => {
  const { t } = useTranslation()
  const status = useStatusMessage()
  // Real per-organization memberships from /auth/me (#795). The options a user
  // may filter by are exactly the organizations they belong to — which is also
  // what the backend validates the request against before answering 403.
  const { memberships } = useAuth()

  // Pagination (MUI TablePagination uses 0-based page)
  const { page, rowsPerPage, setPage, handleChangePage, handleChangeRowsPerPage } =
    usePagination(25)

  // Filters
  const [resourceType, setResourceType] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [userEmailFilter, setUserEmailFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [organizationId, setOrganizationId] = useState(ALL_ORGANIZATIONS)

  // Debounced values for text inputs
  const [debouncedAction, setDebouncedAction] = useState('')
  const [debouncedUserEmail, setDebouncedUserEmail] = useState('')
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Detail dialog
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Export menu
  const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null)

  // THE single description of "what the user is currently looking at".
  //
  // Both the table query and both exports build from this object, and nothing
  // rebuilds the filter list by hand. An export that widens or narrows the
  // filter the table is showing is not a cosmetic bug: the CSV is compliance
  // evidence, and one that silently covers a different slice of the estate than
  // the screen it was taken from is misleading evidence. Keeping one object
  // makes disagreement impossible rather than merely unlikely.
  //
  // Pagination is deliberately NOT part of it — the table shows one page, the
  // export takes the whole filtered set.
  const filterParams = useMemo(
    () => ({
      ...(resourceType ? { resource_type: resourceType } : {}),
      ...(debouncedAction ? { action: debouncedAction } : {}),
      ...(debouncedUserEmail ? { user_email: debouncedUserEmail } : {}),
      ...(startDate ? { start_date: new Date(startDate).toISOString() } : {}),
      ...(endDate ? { end_date: new Date(endDate).toISOString() } : {}),
      // Omitted entirely when unset, so the backend applies the caller's own
      // scope rather than a requested organization.
      ...(organizationId ? { organization_id: organizationId } : {}),
    }),
    [resourceType, debouncedAction, debouncedUserEmail, startDate, endDate, organizationId],
  )

  const queryParams = {
    page: page + 1,
    per_page: rowsPerPage,
    ...filterParams,
  }

  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    // The organization is passed to the key separately as well as riding in
    // queryParams, so switching organizations can never be served the previous
    // organization's page from cache (#798).
    queryKey: queryKeys.auditLogs.list(queryParams, organizationId || undefined),
    queryFn: () => api.listAuditLogs(queryParams),
  })

  const logs = data?.logs ?? []
  const total = data?.pagination?.total ?? 0

  // The backend answers 403 for an organization the caller is not a member of.
  // That is a distinct, recoverable condition ("pick a different organization"),
  // not a load failure, and saying so is what makes it actionable — the generic
  // message reads like an outage the user can do nothing about.
  const isNotAMember = (err: unknown): boolean => getErrorStatus(err) === 403

  if (queryError && !status.error) {
    // Raw error messages can leak implementation details -- route through the
    // shared getErrorMessage helper, which DEV-gates native Error messages
    // the same way ErrorBoundary.tsx does (#618-class).
    status.setError(
      isNotAMember(queryError)
        ? t('admin.auditLog.errNotMember')
        : getErrorMessage(queryError, t('admin.auditLog.errLoad')),
    )
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

  const handleOrganizationChange = (e: SelectChangeEvent) => {
    setOrganizationId(e.target.value)
    // A stale 403 from a previously-selected organization must not survive the
    // change that fixes it.
    status.setError(null)
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
    setOrganizationId(ALL_ORGANIZATIONS)
    setPage(0)
  }

  const handleRowClick = (log: AuditLog) => {
    setSelectedLog(log)
    setDetailOpen(true)
  }

  // Both exports re-fetch the SAME filter the table is showing, unpaginated.
  // Spreading `filterParams` (rather than restating the filters) is what keeps
  // the exported file and the visible table describing the same slice.
  const handleExportCSV = async () => {
    setExportAnchor(null)
    try {
      const result = await api.listAuditLogs({ per_page: 1000, ...filterParams })
      api.exportAuditLogsCSV(result.logs ?? [])
    } catch (err) {
      status.setError(
        isNotAMember(err) ? t('admin.auditLog.errNotMember') : 'Failed to export audit logs',
      )
    }
  }

  const handleExportJSON = async () => {
    setExportAnchor(null)
    try {
      const result = await api.listAuditLogs({ per_page: 1000, ...filterParams })
      api.exportAuditLogsJSON(result.logs ?? [])
    } catch (err) {
      status.setError(
        isNotAMember(err) ? t('admin.auditLog.errNotMember') : 'Failed to export audit logs',
      )
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
      <PageHeader
        icon={<PageTitleIcon />}
        title="Audit Logs"
        description="Track system activity across all resources and users"
        actions={
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
        }
      />
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
          {/*
            Rendered only when the caller belongs to at least one organization:
            the options are their memberships, so with none there is nothing to
            choose between. Its absence is not a restriction — an unset filter
            already returns everything the caller may see, which for a platform
            admin is the whole estate.
          */}
          {memberships.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="organization-label">
                {t('admin.auditLog.labelOrganization')}
              </InputLabel>
              <Select
                labelId="organization-label"
                value={organizationId}
                label={t('admin.auditLog.labelOrganization')}
                onChange={handleOrganizationChange}
                inputProps={{ 'data-testid': 'organization-select' }}
              >
                <MenuItem value={ALL_ORGANIZATIONS}>
                  {t('admin.auditLog.optionAllOrganizations')}
                </MenuItem>
                {/*
                  organization_name is the organization's URL-safe SLUG, which
                  is all /auth/me sends — the human display name is not on this
                  payload at all. Shown as-is rather than prettified: inventing
                  a display name here would make the label disagree with the
                  one the organizations admin page shows. Surfacing the real
                  display name is a backend change.
                */}
                {memberships.map((m) => (
                  <MenuItem key={m.organization_id} value={m.organization_id}>
                    {m.organization_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
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
      <StatusAlerts status={status} mb={2} />
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
                        <TableCell>{resourceTypeLabel(log.resource_type)}</TableCell>
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
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
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
                  <Typography variant="body2">
                    {resourceTypeLabel(selectedLog.resource_type)}
                  </Typography>
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
