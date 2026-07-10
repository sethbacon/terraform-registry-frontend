import { AxiosError } from 'axios'
import i18n from '../i18n'

/**
 * Extracts a human-readable error message from an unknown catch-block value.
 * Handles Axios errors (with nested response.data.error), native Errors, and
 * arbitrary thrown values.
 */
export function getErrorMessage(err: unknown, fallback = 'An unexpected error occurred'): string {
  if (err instanceof AxiosError) {
    // No response at all (offline, DNS failure, CORS, timeout) means err.message is
    // axios/browser boilerplate like "Network Error" -- show a friendly, localized
    // message instead of surfacing that raw string to the user.
    if (!err.response) return i18n.t('common.networkError')
    const serverMessage = (err.response.data as Record<string, unknown>)?.error
    if (typeof serverMessage === 'string') return serverMessage
    return err.message || fallback
  }
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return fallback
}

/**
 * Type-safe access to Axios error response status code.
 */
export function getErrorStatus(err: unknown): number | undefined {
  if (err instanceof AxiosError) return err.response?.status
  return undefined
}
