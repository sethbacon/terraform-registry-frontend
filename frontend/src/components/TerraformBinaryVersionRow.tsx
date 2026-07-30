import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Typography,
  Box,
  Chip,
  Tooltip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Collapse,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import WarningIcon from '@mui/icons-material/Warning'
import RestoreIcon from '@mui/icons-material/Restore'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import TerraformBinaryPlatformRows from './TerraformBinaryPlatformRows'
import { type TerraformVersion, syncStatusColor } from '../types/terraform_mirror'

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

interface TerraformBinaryVersionRowProps {
  version: TerraformVersion
  mirrorName: string
  tool: string
  canManage: boolean
  onDeprecate: (v: TerraformVersion) => void
  onUndeprecate: (v: TerraformVersion) => void
  onDelete: (v: TerraformVersion) => void
}

/**
 * One row of the mirrored-binary versions table, with an expandable panel that
 * lazily loads the version's platform build matrix.
 */
const TerraformBinaryVersionRow: React.FC<TerraformBinaryVersionRowProps> = ({
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
                  <TerraformBinaryPlatformRows mirrorName={mirrorName} version={version.version} />
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

export default TerraformBinaryVersionRow
