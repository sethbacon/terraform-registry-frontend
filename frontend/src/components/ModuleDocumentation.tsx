import React from 'react'
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
  if (docsLoading) return null

  if (!moduleDocs) {
    return (
      <Typography variant="body2" color="text.secondary">
        No inputs, outputs, or provider requirements detected for this module version.
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
      <Typography variant="body2" color="text.secondary">
        No inputs, outputs, or provider requirements detected for this module version.
      </Typography>
    )
  }

  return (
    <Box>
      {moduleDocs.requirements?.required_version && (
        <Box mb={2}>
          <Typography variant="subtitle2" gutterBottom>
            Terraform Version Requirement
          </Typography>
          <Typography variant="body2" fontFamily="monospace">
            {moduleDocs.requirements.required_version}
          </Typography>
        </Box>
      )}

      {inputs.length > 0 && (
        <Box mb={3}>
          <Typography variant="subtitle2" gutterBottom>
            Inputs
          </Typography>
          <TableContainer>
            <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '22%' }}>
                    <strong>Name</strong>
                  </TableCell>
                  <TableCell sx={{ width: '14%' }}>
                    <strong>Type</strong>
                  </TableCell>
                  <TableCell sx={{ width: '34%' }}>
                    <strong>Description</strong>
                  </TableCell>
                  <TableCell sx={{ width: '20%' }}>
                    <strong>Default</strong>
                  </TableCell>
                  <TableCell sx={{ width: '10%' }}>
                    <strong>Required</strong>
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
                        label={inp.required ? 'Yes' : 'No'}
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
        <Box mb={3}>
          <Typography variant="subtitle2" gutterBottom>
            Outputs
          </Typography>
          <TableContainer>
            <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '25%' }}>
                    <strong>Name</strong>
                  </TableCell>
                  <TableCell sx={{ width: '65%' }}>
                    <strong>Description</strong>
                  </TableCell>
                  <TableCell sx={{ width: '10%' }}>
                    <strong>Sensitive</strong>
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
                        <Chip label="Sensitive" size="small" color="warning" variant="outlined" />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
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
            Provider Requirements
          </Typography>
          <TableContainer>
            <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '20%' }}>
                    <strong>Name</strong>
                  </TableCell>
                  <TableCell sx={{ width: '50%' }}>
                    <strong>Source</strong>
                  </TableCell>
                  <TableCell sx={{ width: '30%' }}>
                    <strong>Version Constraints</strong>
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
