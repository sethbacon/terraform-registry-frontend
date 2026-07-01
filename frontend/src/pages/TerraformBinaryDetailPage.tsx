import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom'
import {
  Typography,
  Box,
  Breadcrumbs,
  Link,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Tooltip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material'
import ArrowBack from '@mui/icons-material/ArrowBack'
import DeleteIcon from '@mui/icons-material/Delete'
import WarningIcon from '@mui/icons-material/Warning'
import RestoreIcon from '@mui/icons-material/Restore'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import Page from '../components/Page'
import api from '../services/api'
import { getErrorMessage } from '../utils/errors'
import {
  type TerraformVersion,
  type TerraformVersionPlatform,
  syncStatusColor,
} from '../types/terraform_mirror'
import { useAuth } from '../contexts/AuthContext'

// Minimal config shape returned by the public endpoint
interface PublicMirrorSummary {
  name: string
  description?: string | null
  tool: string
}

// ---------------------------------------------------------------------------
// Platform sub-row (expandable)
// ---------------------------------------------------------------------------

// Uses the public /terraform/binaries/:name/versions/:version endpoint which
// returns platform data without requiring authentication.
const PlatformRows: React.FC<{ mirrorName: string; version: string }> = ({
  mirrorName,
  version,
}) => {
  const { t } = useTranslation()
  const [platforms, setPlatforms] = useState<TerraformVersionPlatform[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .getPublicTerraformVersion(mirrorName, version)
      .then((data) => {
        if (!cancelled) setPlatforms(data.platforms ?? [])
      })
      .catch(() => {
        if (!cancelled) setPlatforms([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [mirrorName, version])

  if (loading) {
    return (
      <TableRow>
        <TableCell colSpan={6} sx={{ py: 1 }}>
          <CircularProgress size={16} />
        </TableCell>
      </TableRow>
    )
  }

  if (!platforms || platforms.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={6} sx={{ py: 1 }}>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
            }}
          >
            {t('terraformBinaries.detail.noPlatformsSynced')}
          </Typography>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <>
      {platforms.map((p) => (
        <TableRow key={p.id} sx={{ bgcolor: 'action.hover' }}>
          <TableCell sx={{ pl: 6 }} colSpan={2}>
            <Typography
              variant="caption"
              sx={{
                fontFamily: 'monospace',
              }}
            >
              {p.os} / {p.arch}
            </Typography>
          </TableCell>
          <TableCell>
            <Chip label={p.sync_status} color={syncStatusColor(p.sync_status)} size="small" />
          </TableCell>
          <TableCell>
            <Typography
              variant="caption"
              sx={{
                fontFamily: 'monospace',
                wordBreak: 'break-all',
              }}
            >
              {p.filename}
            </Typography>
          </TableCell>
          <TableCell>
            {p.sha256_verified ? (
              <CheckCircleIcon color="success" fontSize="small" />
            ) : (
              <ErrorIcon color="disabled" fontSize="small" />
            )}
          </TableCell>
          <TableCell>
            {p.gpg_verified ? (
              <CheckCircleIcon color="success" fontSize="small" />
            ) : (
              <ErrorIcon color="disabled" fontSize="small" />
            )}
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Version row
// ---------------------------------------------------------------------------

/** Derive the upstream release-notes URL for known tools. Returns null for custom/unknown tools. */
export function getChangelogUrl(tool: string, version: string): string | null {
  const v = version.startsWith('v') ? version : `v${version}`
  switch (tool) {
    case 'terraform':
      return `https://github.com/hashicorp/terraform/releases/tag/${v}`
    case 'opentofu':
      return `https://github.com/opentofu/opentofu/releases/tag/${v}`
    case 'opa':
      return `https://github.com/open-policy-agent/opa/releases/tag/${v}`
    case 'packer':
      return `https://github.com/hashicorp/packer/releases/tag/${v}`
    case 'terraform-docs':
      return `https://github.com/terraform-docs/terraform-docs/releases/tag/${v}`
    case 'sentinel':
      // Sentinel is closed-source with no per-version GitHub releases; link the
      // consolidated changelog page instead of a per-version tag.
      return 'https://developer.hashicorp.com/sentinel/docs/changelog'
    default:
      return null
  }
}

interface VersionRowProps {
  version: TerraformVersion
  mirrorName: string
  tool: string
  canManage: boolean
  onDeprecate: (v: TerraformVersion) => void
  onUndeprecate: (v: TerraformVersion) => void
  onDelete: (v: TerraformVersion) => void
}

const VersionRow: React.FC<VersionRowProps> = ({
  version,
  mirrorName,
  tool,
  canManage,
  onDeprecate,
  onUndeprecate,
  onDelete,
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const changelogUrl = getChangelogUrl(tool, version.version)

  return (
    <>
      <TableRow
        hover
        sx={{
          '& > *': { borderBottom: 'unset' },
          opacity: version.is_deprecated ? 0.6 : 1,
        }}
      >
        <TableCell width={48}>
          <IconButton
            size="small"
            aria-label={t('terraformBinaries.detail.ariaToggle')}
            onClick={() => setOpen((p) => !p)}
          >
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
              }}
            >
              {version.version}
            </Typography>
            {changelogUrl && (
              <Tooltip title={t('terraformBinaries.detail.tooltipReleaseNotes')}>
                <IconButton
                  size="small"
                  component="a"
                  href={changelogUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Release notes for ${version.version}`}
                >
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {version.is_latest && <Chip label="latest" color="primary" size="small" />}
            {version.is_deprecated && (
              <Chip label="deprecated" color="warning" size="small" icon={<WarningIcon />} />
            )}
          </Box>
        </TableCell>
        <TableCell>
          <Chip
            label={version.sync_status}
            color={syncStatusColor(version.sync_status)}
            size="small"
          />
        </TableCell>
        <TableCell>
          {version.synced_at ? new Date(version.synced_at).toLocaleString() : '—'}
        </TableCell>
        {canManage && (
          <TableCell align="right">
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
              {version.is_deprecated ? (
                <Tooltip title={t('terraformBinaries.detail.tooltipUndeprecate')}>
                  <IconButton
                    size="small"
                    aria-label={t('terraformBinaries.detail.ariaUndeprecate')}
                    onClick={() => onUndeprecate(version)}
                  >
                    <RestoreIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : (
                <Tooltip title={t('terraformBinaries.detail.tooltipDeprecate')}>
                  <IconButton
                    size="small"
                    aria-label={t('terraformBinaries.detail.ariaDeprecate')}
                    color="warning"
                    onClick={() => onDeprecate(version)}
                    disabled={version.sync_status === 'syncing'}
                  >
                    <WarningIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={t('terraformBinaries.detail.tooltipDeleteVersion')}>
                <span>
                  <IconButton
                    size="small"
                    aria-label={t('terraformBinaries.detail.ariaDeleteVersion')}
                    color="error"
                    onClick={() => onDelete(version)}
                    disabled={version.sync_status === 'syncing'}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </TableCell>
        )}
      </TableRow>
      {/* Expandable platform detail */}
      <TableRow>
        <TableCell
          colSpan={canManage ? 5 : 4}
          sx={{ pb: 0, pt: 0, borderBottom: open ? undefined : 'none' }}
        >
          <Collapse in={open} unmountOnExit>
            <Box sx={{ mb: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell colSpan={2} sx={{ pl: 6, fontWeight: 600 }}>
                      {t('terraformBinaries.detail.thPlatform')}
                    </TableCell>
                    <TableCell>{t('terraformBinaries.detail.thStatus')}</TableCell>
                    <TableCell>{t('terraformBinaries.detail.thFilename')}</TableCell>
                    <TableCell>SHA256</TableCell>
                    <TableCell>GPG</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <PlatformRows mirrorName={mirrorName} version={version.version} />
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const TerraformBinaryDetailPage: React.FC = () => {
  const { t } = useTranslation()
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, allowedScopes } = useAuth()
  const canManage =
    isAuthenticated && (allowedScopes.includes('admin') || allowedScopes.includes('mirrors:manage'))

  const [config, setConfig] = useState<PublicMirrorSummary | null>(null)
  // configId is the UUID needed for admin actions (deprecate/delete)
  const [configId, setConfigId] = useState<string | null>(null)
  const [versions, setVersions] = useState<TerraformVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // Deprecate dialog
  const [deprecateTarget, setDeprecateTarget] = useState<TerraformVersion | null>(null)
  const [deprecateMessage, setDeprecateMessage] = useState('')
  const [deprecating, setDeprecating] = useState(false)

  // Undeprecate
  const [undeprecating, setUndeprecating] = useState(false)

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<TerraformVersion | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    if (!name) return
    setLoading(true)
    setError(null)
    try {
      // Both endpoints are public — no auth required.
      // The versions response includes config_id (UUID) which we need for admin actions.
      const [publicConfigs, versionsData] = await Promise.all([
        api.listPublicTerraformMirrorConfigs(),
        api.listPublicTerraformVersions(name),
      ])
      const found = publicConfigs.find((c) => c.name === name)
      if (!found) {
        setError(`Mirror config "${name}" not found.`)
        return
      }
      setConfig(found)
      // Extract the config UUID from the first version record so we can call
      // admin actions (deprecate / delete / platforms) without hitting admin list.
      const versionRows = versionsData.versions ?? []
      if (versionRows.length > 0) {
        setConfigId(versionRows[0].config_id)
      }
      // Sort: latest first, then by version desc
      const sorted = [...versionRows].sort((a, b) => {
        if (a.is_latest !== b.is_latest) return a.is_latest ? -1 : 1
        return b.version.localeCompare(a.version, undefined, { numeric: true })
      })
      setVersions(sorted)
    } catch {
      setError(`Failed to load details for "${name}".`)
    } finally {
      setLoading(false)
    }
  }, [name])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ---------------------------------------------------------------------------
  // Deprecate
  // ---------------------------------------------------------------------------

  const handleDeprecate = async () => {
    if (!configId || !deprecateTarget) return
    setDeprecating(true)
    try {
      await api.deprecateTerraformVersion(configId, deprecateTarget.version)
      setActionSuccess(
        `Version ${deprecateTarget.version} marked as deprecated. It will not be re-synced.`,
      )
      setDeprecateTarget(null)
      setDeprecateMessage('')
      loadData()
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, 'Failed to deprecate version'))
    } finally {
      setDeprecating(false)
    }
  }

  const handleUndeprecate = async (version: TerraformVersion) => {
    if (!configId) return
    setUndeprecating(true)
    try {
      await api.undeprecateTerraformVersion(configId, version.version)
      setActionSuccess(`Deprecation removed from version ${version.version}.`)
      loadData()
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, 'Failed to remove deprecation'))
    } finally {
      setUndeprecating(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  const handleDelete = async () => {
    if (!configId || !deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteTerraformVersion(configId, deleteTarget.version)
      setActionSuccess(`Version ${deleteTarget.version} deleted.`)
      setDeleteTarget(null)
      loadData()
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, 'Failed to delete version'))
    } finally {
      setDeleting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const toolLabel =
    config?.tool === 'terraform'
      ? 'Terraform (HashiCorp)'
      : config?.tool === 'opentofu'
        ? 'OpenTofu'
        : (config?.tool ?? '')

  const toolColor =
    config?.tool === 'terraform' ? 'primary' : config?.tool === 'opentofu' ? 'secondary' : 'default'

  return (
    <Box aria-busy={loading} aria-live="polite">
      {loading ? (
        <Page>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
            <CircularProgress />
          </Box>
        </Page>
      ) : error ? (
        <Page>
          <Alert severity="error">{error}</Alert>
          <Button
            sx={{ mt: 2 }}
            startIcon={<ArrowBack />}
            onClick={() => navigate('/terraform-binaries')}
          >
            Back to Mirrors
          </Button>
        </Page>
      ) : (
        <Page maxWidth="lg">
          {/* Breadcrumbs */}
          <Breadcrumbs sx={{ mb: 2 }}>
            <Link component={RouterLink} to="/terraform-binaries" underline="hover" color="inherit">
              Terraform Binaries
            </Link>
            <Typography
              sx={{
                color: 'text.primary',
                fontFamily: 'monospace',
              }}
            >
              {name}
            </Typography>
          </Breadcrumbs>

          {/* Back button + title */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Tooltip title={t('terraformBinaries.detail.tooltipBackToMirrors')}>
              <IconButton
                size="small"
                aria-label={t('terraformBinaries.detail.ariaBackToBinaries')}
                onClick={() => navigate('/terraform-binaries')}
              >
                <ArrowBack />
              </IconButton>
            </Tooltip>
            <Typography
              variant="h4"
              sx={{
                fontFamily: 'monospace',
              }}
            >
              {name}
            </Typography>
            <Chip
              label={toolLabel}
              color={toolColor as 'primary' | 'secondary' | 'default'}
              size="small"
              variant="outlined"
            />
            {/* Public endpoint only returns enabled configs; no disabled chip needed */}
          </Box>

          {config?.description && (
            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary',
                mb: 2,
              }}
            >
              {config.description}
            </Typography>
          )}

          {/* Download URL hint */}
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>{t('terraformBinaries.detail.mirrorUrlLabel')}</strong>
              <code>
                {window.location.origin}/terraform/binaries/{name}
                /versions/&#123;version&#125;/&#123;os&#125;/&#123;arch&#125;
              </code>
            </Typography>
          </Alert>

          {actionError && (
            <Alert severity="error" onClose={() => setActionError(null)} sx={{ mb: 2 }}>
              {actionError}
            </Alert>
          )}
          {actionSuccess && (
            <Alert severity="success" onClose={() => setActionSuccess(null)} sx={{ mb: 2 }}>
              {actionSuccess}
            </Alert>
          )}

          {/* Versions table */}
          <Typography variant="h6" sx={{ mb: 1 }}>
            {t('terraformBinaries.detail.versionsTitle')}
          </Typography>

          {versions.length === 0 ? (
            <Alert severity="info">{t('terraformBinaries.detail.noVersionsSynced')}</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={48} />
                    <TableCell>{t('terraformBinaries.detail.thVersion')}</TableCell>
                    <TableCell>{t('terraformBinaries.detail.thStatus')}</TableCell>
                    <TableCell>{t('terraformBinaries.detail.thSyncedAt')}</TableCell>
                    {canManage && (
                      <TableCell align="right">{t('terraformBinaries.detail.thActions')}</TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {versions.map((v) => (
                    <VersionRow
                      key={v.id}
                      version={v}
                      mirrorName={name ?? ''}
                      tool={config?.tool ?? ''}
                      canManage={canManage}
                      onDeprecate={setDeprecateTarget}
                      onUndeprecate={handleUndeprecate}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* ---- Deprecate Dialog ---- */}
          <Dialog
            open={!!deprecateTarget}
            onClose={() => {
              setDeprecateTarget(null)
              setDeprecateMessage('')
            }}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              {t('terraformBinaries.detail.deprecateDialogTitleBefore')}
              {deprecateTarget?.version}
            </DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {t('terraformBinaries.detail.deprecateDialogBody')}
              </Typography>
              <TextField
                label={t('terraformBinaries.detail.labelReasonOptional')}
                value={deprecateMessage}
                onChange={(e) => setDeprecateMessage(e.target.value)}
                fullWidth
                multiline
                rows={2}
                helperText={t('terraformBinaries.detail.helpReason')}
              />
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setDeprecateTarget(null)
                  setDeprecateMessage('')
                }}
              >
                {t('terraformBinaries.detail.cancel')}
              </Button>
              <Button
                color="warning"
                variant="contained"
                onClick={handleDeprecate}
                disabled={deprecating || undeprecating}
              >
                {deprecating ? (
                  <CircularProgress size={18} />
                ) : (
                  t('terraformBinaries.detail.deprecate')
                )}
              </Button>
            </DialogActions>
          </Dialog>

          {/* ---- Delete Dialog ---- */}
          <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
            <DialogTitle>
              {t('terraformBinaries.detail.deleteDialogTitleBefore')}
              {deleteTarget?.version}
            </DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to delete version <strong>{deleteTarget?.version}</strong>?
                This removes the version record and cannot be undone. Any synced binaries in storage
                will also be removed.
              </Typography>
              {deleteTarget?.is_deprecated === false && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Consider deprecating instead of deleting — deprecated versions are retained for
                  download but will not be re-synced.
                </Alert>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteTarget(null)}>
                {t('terraformBinaries.detail.cancel')}
              </Button>
              <Button color="error" variant="contained" onClick={handleDelete} disabled={deleting}>
                {deleting ? <CircularProgress size={18} /> : t('terraformBinaries.detail.delete')}
              </Button>
            </DialogActions>
          </Dialog>
        </Page>
      )}
    </Box>
  )
}

export default TerraformBinaryDetailPage
