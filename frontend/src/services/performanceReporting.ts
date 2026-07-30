/**
 * Performance reporting service using Web Vitals.
 *
 * Reports Core Web Vitals (CLS, FCP, LCP, INP, TTFB) and custom navigation
 * timing to a configurable endpoint. In development mode, metrics are logged
 * to the console. In production, they are batched and flushed periodically
 * to `VITE_PERFORMANCE_DSN` (or `VITE_ERROR_REPORTING_DSN` as fallback).
 */
import type { Metric } from 'web-vitals'
import { sanitizeUrl } from '../utils/sanitizeUrl'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BATCH_INTERVAL_MS = 10_000 // flush every 10 seconds
const MAX_BATCH_SIZE = 25

let dsn: string | null = null
let sessionId: string | null = null
let flushTimer: ReturnType<typeof setInterval> | null = null

interface PerfEntry {
  type: 'web-vital' | 'navigation'
  name: string
  value: number
  rating?: string
  navigationType?: string
  timestamp: string
  url: string
  sessionId: string | null
}

const buffer: PerfEntry[] = []

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function generateSessionId(): string {
  return crypto.randomUUID()
}

/** Send the buffered entries to the configured DSN. */
export function flush(): void {
  if (buffer.length === 0 || !dsn) return

  const entries = buffer.splice(0, buffer.length)

  const payload = JSON.stringify({
    type: 'performance',
    entries,
    release: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : undefined,
  })

  // Use sendBeacon when available (e.g. on page unload) with fetch as fallback
  if (typeof navigator.sendBeacon === 'function') {
    const sent = navigator.sendBeacon(dsn, payload)
    if (sent) return
  }

  fetch(dsn, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // Silently drop — we don't want perf reporting failures to affect the app
  })
}

function enqueue(entry: PerfEntry): void {
  buffer.push(entry)
  if (buffer.length >= MAX_BATCH_SIZE) {
    flush()
  }
  // flush() above clears the buffer synchronously once a DSN is configured,
  // so this is only a safety net for reentrancy/burst edge cases in the Web
  // Vitals path (handleMetric below) -- cap at the batch size, evicting the
  // oldest entries first, the same bounded-ring-buffer approach
  // errorReporting.ts uses for breadcrumbs. reportNavigation() below never
  // reaches this function at all until the service is active (see its own
  // consent/active-service gate), so it cannot contribute unbounded growth.
  if (buffer.length > MAX_BATCH_SIZE) {
    buffer.splice(0, buffer.length - MAX_BATCH_SIZE)
  }
}

function handleMetric(metric: Metric): void {
  const entry: PerfEntry = {
    type: 'web-vital',
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    navigationType: metric.navigationType,
    timestamp: new Date().toISOString(),
    url: sanitizeUrl(window.location.href),
    sessionId,
  }

  if (import.meta.env.DEV) {
    console.log(`[Perf] ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`)
  }

  enqueue(entry)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the performance reporting module. Call once at app startup.
 *
 * - Registers all Core Web Vitals callbacks.
 * - Sets up a periodic flush timer.
 * - Hooks into `visibilitychange` / `pagehide` to flush on tab close.
 */
export function init(): void {
  sessionId = generateSessionId()

  dsn = import.meta.env.VITE_PERFORMANCE_DSN || import.meta.env.VITE_ERROR_REPORTING_DSN || null

  if (dsn) {
    console.log('[Perf] Initialized — reporting to DSN endpoint')
  } else {
    console.log('[Perf] No DSN configured — metrics logged to console only')
  }

  // Dynamically import web-vitals to keep the main bundle small (tree-shaken
  // in production builds where DSN is absent, and lazily loaded otherwise).
  import('web-vitals').then(({ onCLS, onFCP, onLCP, onTTFB, onINP }) => {
    onCLS(handleMetric)
    onFCP(handleMetric)
    onLCP(handleMetric)
    onTTFB(handleMetric)
    onINP(handleMetric)
  })

  // Periodic flush
  flushTimer = setInterval(flush, BATCH_INTERVAL_MS)

  // Flush on page hide / unload
  const flushOnExit = () => flush()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnExit()
  })
  window.addEventListener('pagehide', flushOnExit)
}

/**
 * Report a route-level navigation timing.
 *
 * `useNavigationBreadcrumbs.ts` calls this unconditionally on every SPA route
 * change, regardless of the user's telemetry consent -- unlike the Web Vitals
 * metrics above, which can't fire at all until `init()` has registered their
 * callbacks. Without an equivalent guard here, this would be the one
 * telemetry entry point that keeps recording (and, once a DSN is later
 * configured via consent, retroactively flushing) navigation history for
 * users who never consented. So: only enqueue once the service is active
 * (a DSN has been resolved by `init()`) -- the same active/consent check
 * `flush()` itself uses. Dev-mode console logging stays unconditional (it
 * never leaves the browser) so local debugging still works before consent.
 *
 * @param routeName  The destination route (e.g. "/admin/users").
 * @param durationMs Time taken for the navigation in milliseconds.
 */
export function reportNavigation(routeName: string, durationMs: number): void {
  if (import.meta.env.DEV) {
    console.log(`[Perf] Navigation → ${routeName}: ${durationMs.toFixed(1)}ms`)
  }

  if (!dsn) return

  const entry: PerfEntry = {
    type: 'navigation',
    name: routeName,
    value: durationMs,
    timestamp: new Date().toISOString(),
    url: sanitizeUrl(window.location.href),
    sessionId,
  }

  enqueue(entry)
}

/**
 * Tear down the reporting service (useful for tests).
 */
export function destroy(): void {
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
  buffer.length = 0
  dsn = null
  sessionId = null
}
