import { useCallback, useState } from 'react'

/** The error/success banner state an admin page shows above its content. */
export interface StatusMessage {
  error: string | null
  success: string | null
  setError: (message: string | null) => void
  setSuccess: (message: string | null) => void
  /** Record a success and drop any error still on screen. */
  showSuccess: (message: string) => void
  /** Clear both messages. */
  clear: () => void
}

/**
 * Shared "one error banner + one success banner" state for admin pages.
 *
 * Extracted from the `useState<string | null>(null)` pair that was repeated
 * verbatim across the admin pages, each with its own copy of the
 * clear-the-error-when-an-action-succeeds wiring. Render the messages with
 * `<StatusAlerts status={status} mb={n} order={...} dismissible={...} />`,
 * which takes this whole object so that a dismiss handler cannot be wired to
 * the wrong message.
 *
 * `setError` and `setSuccess` are deliberately independent: setting an error
 * does not clear a previous success, because none of the pages did that.
 * `showSuccess` is the one combination the pages did share.
 */
export function useStatusMessage(): StatusMessage {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const showSuccess = useCallback((message: string) => {
    setSuccess(message)
    setError(null)
  }, [])

  const clear = useCallback(() => {
    setError(null)
    setSuccess(null)
  }, [])

  return { error, success, setError, setSuccess, showSuccess, clear }
}
