import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DeleteIcon from '@mui/icons-material/Delete'
import ErrorIcon from '@mui/icons-material/Error'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import api from '../../../services/api'
import type { TerraformVersion, TerraformVersionPlatform } from '../../../types/terraform_mirror'
import { SyncStatusChip } from './StatusChips'

/**
 * One row of the versions dialog, owning the lazy per-row platform fetch that
 * fires the first time the row is expanded and is cached for the row's lifetime.
 */
const MirrorVersionRow: React.FC<{
  version: TerraformVersion
  configId: string
  onDelete: (v: TerraformVersion) => void
  canManage: boolean
}> = ({ version, configId, onDelete, canManage }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [platforms, setPlatforms] = useState<TerraformVersionPlatform[] | null>(null)
  const [loadingPlatforms, setLoadingPlatforms] = useState(false)

  const handleExpand = async () => {
    if (!open && platforms === null) {
      setLoadingPlatforms(true)
      try {
        const data = await api.listTerraformVersionPlatforms(configId, version.version)
        setPlatforms(data)
      } catch {
        setPlatforms([])
      } finally {
        setLoadingPlatforms(false)
      }
    }
    setOpen((prev) => !prev)
  }

  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton
            size="small"
            aria-label={t('admin.terraformMirror.ariaToggleVersionDetails')}
            onClick={handleExpand}
          >
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
              }}
            >
              {version.version}
            </Typography>
            {version.is_latest && (
              <Chip label={t('admin.terraformMirror.chipLatest')} color="primary" size="small" />
            )}
            {version.is_deprecated && (
              <Chip
                label={t('admin.terraformMirror.chipDeprecated')}
                color="warning"
                size="small"
              />
            )}
          </Box>
        </TableCell>
        <TableCell>
          <SyncStatusChip status={version.sync_status} />
        </TableCell>
        <TableCell>
          {version.approval_status && (
            <Chip
              label={t(`admin.versionApprovals.status.${version.approval_status}`)}
              size="small"
              color={
                version.approval_status === 'approved'
                  ? 'success'
                  : version.approval_status === 'rejected'
                    ? 'error'
                    : 'warning'
              }
            />
          )}
        </TableCell>
        <TableCell>
          {version.synced_at ? new Date(version.synced_at).toLocaleString() : '—'}
        </TableCell>
        <TableCell align="right">
          {canManage && (
            <Tooltip title={t('admin.terraformMirror.tooltipDeleteVersion')}>
              <span>
                <IconButton
                  size="small"
                  aria-label={t('admin.terraformMirror.ariaDeleteVersion')}
                  color="error"
                  onClick={() => onDelete(version)}
                  disabled={version.sync_status === 'syncing'}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={6} sx={{ pb: 0, pt: 0 }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ m: 1, mb: 2 }}>
              {loadingPlatforms ? (
                <CircularProgress size={20} />
              ) : platforms && platforms.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>OS</TableCell>
                      <TableCell>{t('admin.terraformMirror.thArch')}</TableCell>
                      <TableCell>{t('admin.terraformMirror.thFilename')}</TableCell>
                      <TableCell>{t('admin.terraformMirror.thStatus')}</TableCell>
                      <TableCell>SHA256</TableCell>
                      <TableCell>GPG</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {platforms.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.os}</TableCell>
                        <TableCell>{p.arch}</TableCell>
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
                          <SyncStatusChip status={p.sync_status} />
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
                  </TableBody>
                </Table>
              ) : (
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  {t('admin.terraformMirror.noPlatformsSynced')}
                </Typography>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

export default MirrorVersionRow
