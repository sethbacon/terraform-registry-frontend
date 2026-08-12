import React from 'react'
import { Alert } from '@mui/material'
import type { StatusMessage } from '../hooks/useStatusMessage'

export interface StatusAlertsProps {
  status: StatusMessage
  /**
   * Bottom margin (MUI spacing units) applied to each alert. Required rather
   * than defaulted so every call site restates the spacing its page already
   * used instead of silently inheriting a different one.
   */
  mb: number
}

/**
 * The dismissible error/success banner pair that admin pages render above their
 * content, extracted from the identical JSX each page carried by hand.
 *
 * Renders a fragment, so the alerts stay direct children of whatever laid them
 * out before. Error is rendered above success, matching every page that adopted
 * this component; pages that deliberately render success first keep their own
 * markup.
 */
const StatusAlerts: React.FC<StatusAlertsProps> = ({ status, mb }) => (
  <>
    {status.error && (
      <Alert severity="error" sx={{ mb }} onClose={() => status.setError(null)}>
        {status.error}
      </Alert>
    )}
    {status.success && (
      <Alert severity="success" sx={{ mb }} onClose={() => status.setSuccess(null)}>
        {status.success}
      </Alert>
    )}
  </>
)

export default StatusAlerts
