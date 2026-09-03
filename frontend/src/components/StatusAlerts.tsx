import React from 'react'
import { Alert } from '@mui/material'
import type { StatusMessage } from '../hooks/useStatusMessage'

/**
 * Which banner sits on top when both an error and a success are on screen at
 * once. Most pages show the error first; the pages whose actions report a
 * result immediately above a long form (Notifications, Security Scanning) show
 * the success first, and that ordering is user-visible.
 */
export type StatusAlertOrder = 'error-first' | 'success-first'

export interface StatusAlertsProps {
  status: StatusMessage
  /**
   * Bottom margin (MUI spacing units) applied to each alert. Required rather
   * than defaulted so every call site restates the spacing its page already
   * used instead of silently inheriting a different one. Pass `0` for the
   * upload pages, whose alerts sit in a flow layout with no margin of their own.
   */
  mb: number
  /**
   * Order of the two banners. Required for the same reason as `mb`: which
   * message a user reads first is visible, and a call site cannot tell by
   * inspection whether its page can ever show both at once.
   */
  order: StatusAlertOrder
  /**
   * Whether each banner gets MUI's close button. Required rather than
   * defaulted because the presence of a dismiss affordance is always visible,
   * and the pages genuinely disagree: the admin CRUD pages are dismissible,
   * Organizations and the two upload pages are not.
   */
  dismissible: boolean
}

/**
 * The error/success banner pair that admin pages render above their content,
 * extracted from the identical JSX each page carried by hand.
 *
 * Renders a fragment, so the alerts stay direct children of whatever laid them
 * out before. Both banners render whenever both messages are set — whether a
 * page can reach that state is a property of how it drives `useStatusMessage`,
 * not of this component.
 */
const StatusAlerts: React.FC<StatusAlertsProps> = ({ status, mb, order, dismissible }) => {
  // `onClose` is left undefined rather than set to a no-op when the page is
  // non-dismissible: MUI renders the close button only when a handler is
  // present, so undefined is what reproduces the pages' bare `<Alert>`.
  const errorAlert = status.error && (
    <Alert
      severity="error"
      sx={{ mb }}
      onClose={dismissible ? () => status.setError(null) : undefined}
    >
      {status.error}
    </Alert>
  )
  const successAlert = status.success && (
    <Alert
      severity="success"
      sx={{ mb }}
      onClose={dismissible ? () => status.setSuccess(null) : undefined}
    >
      {status.success}
    </Alert>
  )

  return order === 'success-first' ? (
    <>
      {successAlert}
      {errorAlert}
    </>
  ) : (
    <>
      {errorAlert}
      {successAlert}
    </>
  )
}

export default StatusAlerts
