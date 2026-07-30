import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Paper,
  Typography,
  Divider,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import ContentCopy from '@mui/icons-material/ContentCopy'
import { ProviderPlatform } from '../types'

interface ProviderPlatformsTableProps {
  platforms: ProviderPlatform[]
  /** Checksum currently showing the "Copied!" tooltip, if any. */
  copiedChecksum: string | null
  onCopyChecksum: (checksum: string) => void
}

/**
 * "Available Platforms" table for ProviderDetailPage: the OS/arch build matrix
 * of the selected version with copyable SHA256 sums. Renders nothing when the
 * version has no published platforms.
 */
const ProviderPlatformsTable: React.FC<ProviderPlatformsTableProps> = ({
  platforms,
  copiedChecksum,
  onCopyChecksum,
}) => {
  const { t } = useTranslation()
  if (platforms.length === 0) return null

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Available Platforms
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>OS</TableCell>
              <TableCell>{t('providers.detail.thArchitecture')}</TableCell>
              <TableCell>{t('providers.detail.thSha256Sum')}</TableCell>
              <TableCell width="50px"></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {platforms.map((platform) => (
              <TableRow key={platform.id}>
                <TableCell>{platform.os}</TableCell>
                <TableCell>{platform.arch}</TableCell>
                <TableCell
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    wordBreak: 'break-all',
                  }}
                >
                  {platform.shasum || 'N/A'}
                </TableCell>
                <TableCell>
                  {platform.shasum && (
                    <Tooltip
                      title={
                        copiedChecksum === platform.shasum
                          ? 'Copied!'
                          : t('providers.detail.tooltipCopyChecksum')
                      }
                    >
                      <IconButton
                        size="small"
                        aria-label={t('providers.detail.ariaCopyChecksum')}
                        onClick={() => onCopyChecksum(platform.shasum)}
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}

export default ProviderPlatformsTable
