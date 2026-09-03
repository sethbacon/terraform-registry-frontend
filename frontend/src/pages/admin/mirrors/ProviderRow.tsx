import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { MirroredProvider, MirroredProviderVersion } from '../../../types/mirror'
import VersionPlatformRow from './VersionPlatformRow'

/**
 * One mirrored upstream provider inside the "View Details" dialog, expanding to
 * the versions that have been synced for it. Owns only its own
 * expand/collapse; the versions arrive with the provider payload.
 *
 * Note the "no versions synced" note below is unreachable in practice: the
 * toggle is disabled on exactly the condition that would show it. Kept as-is
 * rather than deleted, because it is the safety net if the toggle ever stops
 * being disabled (#783).
 */
const ProviderRow: React.FC<{ provider: MirroredProvider }> = ({ provider }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const versions: MirroredProviderVersion[] = provider.versions ?? []

  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton
            size="small"
            aria-label={t('admin.mirrors.ariaToggleVersions')}
            onClick={() => setOpen((p) => !p)}
            disabled={versions.length === 0}
          >
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </TableCell>
        <TableCell>{provider.upstream_namespace}</TableCell>
        <TableCell>{provider.upstream_type}</TableCell>
        <TableCell>
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
            }}
          >
            {provider.last_sync_version ?? '—'}
          </Typography>
        </TableCell>
        <TableCell>{versions.length}</TableCell>
        <TableCell>
          {provider.last_synced_at ? new Date(provider.last_synced_at).toLocaleString() : '—'}
        </TableCell>
        <TableCell>
          <Chip
            label={
              provider.sync_enabled
                ? t('admin.mirrors.chipSyncEnabled')
                : t('admin.mirrors.chipSyncDisabled')
            }
            size="small"
            color={provider.sync_enabled ? 'success' : 'default'}
          />
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={7} sx={{ pb: 0, pt: 0 }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ mx: 2, mb: 2 }}>
              {versions.length === 0 ? (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  {t('admin.mirrors.noVersionsSynced')}
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width={40} />
                      <TableCell>{t('admin.mirrors.thVersion')}</TableCell>
                      <TableCell>{t('admin.mirrors.thStatus')}</TableCell>
                      <TableCell>{t('admin.mirrors.thSyncedAt')}</TableCell>
                      <TableCell>{t('admin.mirrors.thShasum')}</TableCell>
                      <TableCell>GPG</TableCell>
                      <TableCell>{t('admin.mirrors.thPlatforms')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {versions.map((v) => (
                      <VersionPlatformRow key={v.id} version={v} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

export default ProviderRow
