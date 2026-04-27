import React from 'react'
import { Box, Typography, Stack } from '@mui/material'

interface ScanDiagnosticsProps {
  errorMessage?: string | null
  executionLog?: string | null
  rawResults?: Record<string, unknown> | null
  /** Optional max height for the scrollable log/raw blocks. */
  maxBlockHeight?: number
}

/**
 * Renders the diagnostic fields a scan can carry: the brief error_message,
 * the captured stderr/stdout (execution_log), and the raw scanner JSON
 * payload. Returns null when none are populated so callers can drop it in
 * unconditionally.
 */
const ScanDiagnostics: React.FC<ScanDiagnosticsProps> = ({
  errorMessage,
  executionLog,
  rawResults,
  maxBlockHeight = 240,
}) => {
  const hasErrorMessage = Boolean(errorMessage)
  const hasLog = Boolean(executionLog)
  const hasRaw = rawResults != null && Object.keys(rawResults).length > 0

  if (!hasErrorMessage && !hasLog && !hasRaw) return null

  return (
    <Stack spacing={2} data-testid="scan-diagnostics">
      {hasErrorMessage && (
        <Section title="Error message" testId="scan-diagnostics-error">
          <Typography variant="body2" color="error.main" sx={{ whiteSpace: 'pre-wrap' }}>
            {errorMessage}
          </Typography>
        </Section>
      )}
      {hasLog && (
        <Section title="Scanner output (stderr / stdout)" testId="scan-diagnostics-log">
          <LogBlock content={executionLog as string} maxHeight={maxBlockHeight} />
        </Section>
      )}
      {hasRaw && (
        <Section title="Raw scanner JSON" testId="scan-diagnostics-raw">
          <LogBlock
            content={JSON.stringify(rawResults, null, 2)}
            maxHeight={maxBlockHeight}
          />
        </Section>
      )}
    </Stack>
  )
}

const Section: React.FC<{
  title: string
  testId?: string
  children: React.ReactNode
}> = ({ title, testId, children }) => (
  <Box data-testid={testId}>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
      {title}
    </Typography>
    {children}
  </Box>
)

const LogBlock: React.FC<{ content: string; maxHeight: number }> = ({ content, maxHeight }) => (
  <Box
    component="pre"
    sx={{
      m: 0,
      p: 1.5,
      maxHeight,
      overflow: 'auto',
      backgroundColor: 'action.hover',
      borderRadius: 1,
      fontSize: '0.75rem',
      fontFamily: 'monospace',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}
  >
    {content}
  </Box>
)

export default ScanDiagnostics
