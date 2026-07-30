import axios, { AxiosError } from 'axios'
import i18n from '../i18n'
import { captureError } from '../services/errorReporting'

/** Longest backend-supplied error string we are willing to render verbatim. */
const MAX_SERVER_MESSAGE_LENGTH = 300

/**
 * Signatures of internal/implementation detail that must never reach the user,
 * even if the backend leaks one into response.data.error (defense in depth for
 * CWE-209). A match routes the message to the generic fallback instead of being
 * rendered — the raw text is still available to telemetry via the AxiosError.
 */
const INTERNAL_DETAIL_SIGNATURES: RegExp[] = [
  /[\r\n]/, // multi-line — almost always a stack trace / panic dump
  /panic:|goroutine\s+\d+|runtime error:/i, // Go panic / stack trace
  /\.go:\d+/i, // Go source location
  /\bat\s+\S+\s+\(?\S+:\d+:\d+\)?/, // JS/Java-style stack frame
  /0x[0-9a-fA-F]{6,}/, // raw memory / pointer address
  /SQLSTATE|\bpq:|\bsql:|syntax error at or near|duplicate key value/i, // DB driver leakage
  /(?:\/(?:usr|home|var|etc|root|app|tmp|opt|data|srv|mnt|storage)\/|[A-Za-z]:\\)/, // absolute filesystem path
  /\bdial (?:tcp|udp)\b/i, // Go net dial error — e.g. "dial tcp 10.0.5.23:5432: connect: ..."
  // Private/internal IPv4 literal (RFC1918 + loopback + link-local) — an infra
  // address leak. Scoped to internal ranges on purpose: a bare all-numeric dotted
  // quad also matches legitimate content (a 4-part version like "1.2.3.4", a public
  // IP a user searched for), and suppressing those would replace a valid backend
  // message with generic boilerplate for no security benefit. Public IPs are not
  // internal-topology disclosure and other signatures (dial tcp, paths) still catch
  // the common leak shapes.
  /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/,
  /\.(?:internal|local|svc\.cluster\.local|cluster\.local)\b/i, // internal service hostname (k8s/LAN)
]

/**
 * Bound and vet a backend-supplied error string before it reaches the UI.
 * Returns the trimmed message when it is short and free of internal-detail
 * signatures, otherwise null so the caller falls back to a generic message.
 */
export function sanitizeServerErrorMessage(raw: string): string | null {
  const message = raw.trim()
  if (!message || message.length > MAX_SERVER_MESSAGE_LENGTH) return null
  if (INTERNAL_DETAIL_SIGNATURES.some((re) => re.test(message))) return null
  return message
}

/**
 * True when a request was aborted via an AbortController/cancel token (e.g. the
 * user hit "Cancel"), as opposed to a genuine failure. Callers use this to reset
 * UI state silently instead of surfacing an error.
 */
export function isCanceledError(err: unknown): boolean {
  return axios.isCancel(err)
}

/**
 * Extracts a human-readable error message from an unknown catch-block value.
 * Handles Axios errors (with nested response.data.error), native Errors, and
 * arbitrary thrown values.
 *
 * As a side effect, reports the caught error to the app's error-telemetry
 * pipeline (captureError), tagged with the caller-supplied fallback message
 * as context, so handled API/UI failures get the same production visibility
 * as uncaught errors instead of only setting local component state (#619).
 */
export function getErrorMessage(err: unknown, fallback = 'An unexpected error occurred'): string {
  captureError(err instanceof Error ? err : new Error(typeof err === 'string' ? err : fallback), {
    context: fallback,
  })
  if (err instanceof AxiosError) {
    // A request that hit the client-side timeout has no response either, but is a
    // distinct, more actionable condition than "can't reach the server at all" --
    // check it first so it doesn't fall into the generic network-error branch below.
    if (err.code === 'ECONNABORTED') return i18n.t('common.timeoutError')
    // No response at all (offline, DNS failure, CORS) means err.message is
    // axios/browser boilerplate like "Network Error" -- show a friendly, localized
    // message instead of surfacing that raw string to the user.
    if (!err.response) return i18n.t('common.networkError')
    const serverMessage = (err.response.data as Record<string, unknown>)?.error
    if (typeof serverMessage === 'string') {
      // Never render the backend string verbatim: bound its length and reject
      // leaked internal detail (stack traces, SQL, file paths). Anything that
      // fails the check falls through to the safe boilerplate/fallback (CWE-209).
      const safe = sanitizeServerErrorMessage(serverMessage)
      if (safe !== null) return safe
    }
    return err.message || fallback
  }
  // A native (non-Axios) Error is typically a client-side bug (TypeError,
  // ReferenceError, etc.) whose message can leak implementation details
  // (variable/property names). Only show it to developers, same DEV gate as
  // ErrorBoundary.tsx (#618).
  if (err instanceof Error) return import.meta.env.DEV ? err.message : fallback
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
