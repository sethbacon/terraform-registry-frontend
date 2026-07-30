import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Typography,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material'
import TerraformBinaryVersionRow from './TerraformBinaryVersionRow'
import { type TerraformVersion } from '../types/terraform_mirror'

interface TerraformBinaryVersionsTableProps {
  versions: TerraformVersion[]
  mirrorName: string
  tool: string
  canManage: boolean
  onDeprecate: (v: TerraformVersion) => void
  onUndeprecate: (v: TerraformVersion) => void
  onDelete: (v: TerraformVersion) => void
}

/**
 * "Versions" section of TerraformBinaryDetailPage: the synced-version table, or
 * an informational alert when nothing has been synced yet.
 */
const TerraformBinaryVersionsTable: React.FC<TerraformBinaryVersionsTableProps> = ({
  versions,
  mirrorName,
  tool,
  canManage,
  onDeprecate,
  onUndeprecate,
  onDelete,
}) => {
  const { t } = useTranslation()

  return (
    <>
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
                <TerraformBinaryVersionRow
                  key={v.id}
                  version={v}
                  mirrorName={mirrorName}
                  tool={tool}
                  canManage={canManage}
                  onDeprecate={onDeprecate}
                  onUndeprecate={onUndeprecate}
                  onDelete={onDelete}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  )
}

export default TerraformBinaryVersionsTable
