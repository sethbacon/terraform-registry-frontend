import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Divider,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
} from '@mui/material';
import { ModuleDoc } from '../types';

interface ModuleDocumentationProps {
  moduleDocs: ModuleDoc | null;
  docsLoading: boolean;
}

const ModuleDocumentation: React.FC<ModuleDocumentationProps> = ({ moduleDocs, docsLoading }) => {
  if (docsLoading || !moduleDocs) return null;

  const inputs = moduleDocs.inputs ?? [];
  const outputs = moduleDocs.outputs ?? [];
  const providers = moduleDocs.providers ?? [];

  if (
    inputs.length === 0 &&
    outputs.length === 0 &&
    providers.length === 0 &&
    !moduleDocs.requirements?.required_version
  ) {
    return null;
  }

  return (
    <Paper sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" gutterBottom>Module Documentation</Typography>
      <Divider sx={{ mb: 2 }} />

      {moduleDocs.requirements?.required_version && (
        <Box mb={2}>
          <Typography variant="subtitle2" gutterBottom>Terraform Version Requirement</Typography>
          <Typography variant="body2" fontFamily="monospace">
            {moduleDocs.requirements.required_version}
          </Typography>
        </Box>
      )}

      {inputs.length > 0 && (
        <Box mb={3}>
          <Typography variant="subtitle2" gutterBottom>Inputs</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Name</strong></TableCell>
                  <TableCell><strong>Type</strong></TableCell>
                  <TableCell><strong>Description</strong></TableCell>
                  <TableCell><strong>Default</strong></TableCell>
                  <TableCell><strong>Required</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inputs.map((inp) => (
                  <TableRow key={inp.name}>
                    <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{inp.name}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{inp.type}</TableCell>
                    <TableCell>{inp.description}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>
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
          <Typography variant="subtitle2" gutterBottom>Outputs</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Name</strong></TableCell>
                  <TableCell><strong>Description</strong></TableCell>
                  <TableCell><strong>Sensitive</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {outputs.map((out) => (
                  <TableRow key={out.name}>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{out.name}</TableCell>
                    <TableCell>{out.description}</TableCell>
                    <TableCell>
                      {out.sensitive
                        ? <Chip label="Sensitive" size="small" color="warning" variant="outlined" />
                        : <Typography variant="body2" color="text.secondary">—</Typography>
                      }
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
          <Typography variant="subtitle2" gutterBottom>Provider Requirements</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Name</strong></TableCell>
                  <TableCell><strong>Source</strong></TableCell>
                  <TableCell><strong>Version Constraints</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {providers.map((prov) => (
                  <TableRow key={prov.name}>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{prov.name}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{prov.source}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{prov.version_constraints}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Paper>
  );
};

export default ModuleDocumentation;
