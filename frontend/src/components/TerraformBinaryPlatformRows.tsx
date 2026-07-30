import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography, Chip, CircularProgress, TableCell, TableRow } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import api from '../services/api'
import { type TerraformVersionPlatform, syncStatusColor } from '../types/terraform_mirror'

interface TerraformBinaryPlatformRowsProps {
  mirrorName: string
  version: string
}

/**
 * Expandable platform sub-rows for a mirrored binary version.
 *
 * Uses the public /terraform/binaries/:name/versions/:version endpoint which
 * returns platform data without requiring authentication.
 */
const TerraformBinaryPlatformRows: React.FC<TerraformBinaryPlatformRowsProps> = ({
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

export default TerraformBinaryPlatformRows
