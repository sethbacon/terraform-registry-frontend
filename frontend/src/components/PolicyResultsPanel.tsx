import React, { useState } from 'react'
import { Box, Paper, Typography, Divider, Chip, Stack, Collapse, IconButton } from '@mui/material'
import PolicyIcon from '@mui/icons-material/Policy'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { PolicyResult } from '../types'

interface PolicyResultsPanelProps {
  policyResult: PolicyResult
}

const PolicyResultsPanel: React.FC<PolicyResultsPanelProps> = ({ policyResult }) => {
  const [expanded, setExpanded] = useState(policyResult.violations.length > 0)

  const hasViolations = policyResult.violations.length > 0

  const statusLabel = !policyResult.allowed ? 'BLOCK' : hasViolations ? 'WARN' : 'PASS'
  const statusColor: 'error' | 'warning' | 'success' = !policyResult.allowed
    ? 'error'
    : hasViolations
      ? 'warning'
      : 'success'

  return (
    <Paper sx={{ p: 3 }}>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <PolicyIcon fontSize="small" color="action" />
        <Typography variant="h6">Policy Evaluation</Typography>
      </Box>
      <Divider sx={{ mb: 2 }} />
      <Box mb={hasViolations ? 1.5 : 0}>
        <Chip label={statusLabel} size="small" color={statusColor} />
        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          mode: {policyResult.mode}
        </Typography>
      </Box>
      {hasViolations && (
        <>
          <Box
            display="flex"
            alignItems="center"
            sx={{ cursor: 'pointer', mb: 0.5 }}
            onClick={() => setExpanded(!expanded)}
          >
            <Typography variant="body2" fontWeight="medium">
              {policyResult.violations.length} violation
              {policyResult.violations.length !== 1 ? 's' : ''}
            </Typography>
            <IconButton size="small" sx={{ ml: 'auto' }}>
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>
          <Collapse in={expanded}>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {policyResult.violations.map((v, i) => (
                <Box key={i} sx={{ pl: 1.5, borderLeft: 2, borderColor: `${statusColor}.main` }}>
                  <Typography variant="caption" fontWeight="medium" display="block">
                    {v.rule}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {v.message}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Collapse>
        </>
      )}
    </Paper>
  )
}

export default PolicyResultsPanel
