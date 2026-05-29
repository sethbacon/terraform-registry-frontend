import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Typography,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
} from '@mui/material'
import { ModuleDoc } from '../types'

interface ModuleDocumentationProps {
  moduleDocs: ModuleDoc | null
  docsLoading: boolean
}

const ModuleDocumentation: React.FC<ModuleDocumentationProps> = ({ moduleDocs, docsLoading }) => {
  const { t } = useTranslation()
  if (docsLoading) return null

  if (!moduleDocs) {
    return (
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
        }}
      >
        {t('moduleDocumentation.noData')}
      </Typography>
    )
  }

  const inputs = moduleDocs.inputs ?? []
  const outputs = moduleDocs.outputs ?? []
  const providers = moduleDocs.providers ?? []

  if (
    inputs.length === 0 &&
    outputs.length === 0 &&
    providers.length === 0 &&
    !moduleDocs.requirements?.required_version
  ) {
    return (
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
        }}
      >
        {t('moduleDocumentation.noData')}
      </Typography>
    )
  }

  return (
    <Box>
      {moduleDocs.requirements?.required_version && (
        <Box
          sx={{
            mb: 2,
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            {t('moduleDocumentation.terraformVersionRequirement')}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
            }}
          >
            {moduleDocs.requirements.required_version}
          </Typography>
        </Box>
      )}
      {inputs.length > 0 && (
        <Box
          sx={{
            mb: 3,
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            {t('moduleDocumentation.inputs')}
          </Typography>
          <TableContainer>
            <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '22%' }}>
                    <strong>{t('moduleDocumentation.thName')}</strong>
                  </TableCell>
                  <TableCell sx={{ width: '14%' }}>
                    <strong>{t('moduleDocumentation.thType')}</strong>
                  </TableCell>
                  <TableCell sx={{ width: '34%' }}>
                    <strong>{t('moduleDocumentation.thDescription')}</strong>
                  </TableCell>
                  <TableCell sx={{ width: '20%' }}>
                    <strong>{t('moduleDocumentation.thDefault')}</strong>
                  </TableCell>
                  <TableCell sx={{ width: '10%' }}>
                    <strong>{t('moduleDocumentation.thRequired')}</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inputs.map((inp) => (
                  <TableRow key={inp.name}>
                    <TableCell sx={{ fontFamily: 'monospace', wordBreak: 'break-word' }}>
                      {inp.name}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', wordBreak: 'break-word' }}>
                      {inp.type}
                    </TableCell>
                    <TableCell>{inp.description}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', wordBreak: 'break-word' }}>
                      {inp.required ? '—' : JSON.stringify(inp.default)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={
                          inp.required ? t('moduleDocumentation.yes') : t('moduleDocumentation.no')
                        }
                        size="small"
                        color={inp.required ? 'error' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
      {outputs.length > 0 && (
        <Box
          sx={{
            mb: 3,
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            {t('moduleDocumentation.outputs')}
          </Typography>
          <TableContainer>
            <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '25%' }}>
                    <strong>{t('moduleDocumentation.thName')}</strong>
                  </TableCell>
                  <TableCell sx={{ width: '65%' }}>
                    <strong>{t('moduleDocumentation.thDescription')}</strong>
                  </TableCell>
                  <TableCell sx={{ width: '10%' }}>
                    <strong>{t('moduleDocumentation.thSensitive')}</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {outputs.map((out) => (
                  <TableRow key={out.name}>
                    <TableCell sx={{ fontFamily: 'monospace', wordBreak: 'break-word' }}>
                      {out.name}
                    </TableCell>
                    <TableCell>{out.description}</TableCell>
                    <TableCell>
                      {out.sensitive ? (
                        <Chip
                          label={t('moduleDocumentation.sensitive')}
                          size="small"
                          color="warning"
                          variant="outlined"
                        />
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.secondary',
                          }}
                        >
                          —
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
      {providers.length > 0 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            {t('moduleDocumentation.providerRequirements')}
          </Typography>
          <TableContainer>
            <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '20%' }}>
                    <strong>{t('moduleDocumentation.thName')}</strong>
                  </TableCell>
                  <TableCell sx={{ width: '50%' }}>
                    <strong>{t('moduleDocumentation.thSource')}</strong>
                  </TableCell>
                  <TableCell sx={{ width: '30%' }}>
                    <strong>{t('moduleDocumentation.thVersionConstraints')}</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {providers.map((prov) => (
                  <TableRow key={prov.name}>
                    <TableCell sx={{ fontFamily: 'monospace', wordBreak: 'break-word' }}>
                      {prov.name}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', wordBreak: 'break-word' }}>
                      {prov.source}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', wordBreak: 'break-word' }}>
                      {prov.version_constraints}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  )
}

export default ModuleDocumentation
