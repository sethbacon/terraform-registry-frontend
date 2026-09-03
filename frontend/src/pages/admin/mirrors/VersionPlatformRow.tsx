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
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { MirroredProviderPlatform, MirroredProviderVersion } from '../../../types/mirror'

/**
 * One synced provider version inside the "View Details" dialog: its approval
 * and checksum/GPG verification state, expanding to the per-platform artefacts
 * that version produced. Owns only its own expand/collapse.
 */
const VersionPlatformRow: React.FC<{ version: MirroredProviderVersion }> = ({ version }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const platforms: MirroredProviderPlatform[] = version.platforms ?? []

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell sx={{ pl: 1 }}>
          <IconButton
            size="small"
            aria-label={t('admin.mirrors.ariaTogglePlatforms')}
            onClick={() => setOpen((p) => !p)}
            disabled={platforms.length === 0}
          >
            {open ? <ExpandLessIcon fontSize="inherit" /> : <ExpandMoreIcon fontSize="inherit" />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography
            variant="caption"
            sx={{
              fontFamily: 'monospace',
            }}
          >
            {version.upstream_version}
          </Typography>
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
        <TableCell>{new Date(version.synced_at).toLocaleString()}</TableCell>
        <TableCell>
          {version.shasum_verified ? (
            <CheckCircleIcon color="success" fontSize="small" />
          ) : (
            <ErrorIcon color="disabled" fontSize="small" />
          )}
        </TableCell>
        <TableCell>
          {version.gpg_verified ? (
            <CheckCircleIcon color="success" fontSize="small" />
          ) : (
            <ErrorIcon color="disabled" fontSize="small" />
          )}
        </TableCell>
        <TableCell>{platforms.length}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={7} sx={{ pb: 0, pt: 0 }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ ml: 4, mb: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>OS</TableCell>
                    <TableCell>{t('admin.mirrors.thArch')}</TableCell>
                    <TableCell>{t('admin.mirrors.thFilename')}</TableCell>
                    <TableCell>SHA256</TableCell>
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
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: 'monospace',
                          }}
                        >
                          {p.shasum ? p.shasum.slice(0, 12) + '…' : '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

export default VersionPlatformRow
