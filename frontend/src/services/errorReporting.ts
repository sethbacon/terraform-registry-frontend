/**
 * Enhanced error reporting service with batching, retry, breadcrumbs,
 * session context, and optional Sentry integration.
 *
 * Configuration:
 *   - `VITE_SENTRY_DSN`          – use the Sentry SDK (preferred for production).
 *   - `VITE_ERROR_REPORTING_DSN` – use the built-in custom reporter.
 *   - Neither set                – errors are logged to the console only.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Breadcrumb {
  type: 'navigation' | 'api' | 'console' | 'click' | 'custom';
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

interface ErrorEntry {
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  timestamp: string;
  url: string;
  userAgent: string;
  userId: string | null;
  sessionId: string | null;
  release: string | undefined;
  breadcrumbs: Breadcrumb[];
}

// ---------------------------------------------------------------------------
// Config / state
// ---------------------------------------------------------------------------

const MAX_BREADCRUMBS = 20;
const BATCH_FLUSH_INTERVAL_MS = 5_000;
const MAX_BATCH_SIZE = 10;
const MAX_RETRIES = 3;

let dsn: string | null = null;
let currentUser: string | null = null;
let sessionId: string | null = null;
let useSentry = false;
let flushTimer: ReturnType<typeof setInterval> | null = null;

const breadcrumbs: Breadcrumb[] = [];
const errorBuffer: ErrorEntry[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function addBreadcrumb(crumb: Breadcrumb): void {
  breadcrumbs.push(crumb);
  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }
}

function getRelease(): string | undefined {
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : undefined;
}

// ---------------------------------------------------------------------------
// Batching & retry
// ---------------------------------------------------------------------------

async function sendWithRetry(payload: string, attempt = 1): Promise<void> {
  if (!dsn) return;

  try {
    const res = await fetch(dsn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    });
    // Treat server errors as retriable
    if (!res.ok && attempt < MAX_RETRIES) {
      const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
      await new Promise((r) => setTimeout(r, delay));
      return sendWithRetry(payload, attempt + 1);
    }
  } catch {
    if (attempt < MAX_RETRIES) {
      const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
      await new Promise((r) => setTimeout(r, delay));
      return sendWithRetry(payload, attempt + 1);
    }
    // Silently drop after max retries — we don't want error reporting to
    // itself cause errors in the app.
  }
}

export function flush(): void {
  if (errorBuffer.length === 0 || !dsn) return;

  const entries = errorBuffer.splice(0, errorBuffer.length);
  const payload = JSON.stringify({ type: 'errors', entries });

  // Use sendBeacon on page hide, fetch otherwise
  if (document.visibilityState === 'hidden' && typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon(dsn, payload);
    return;
  }

  sendWithRetry(payload).catch(() => {
    // Final fallback — silently drop
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise error reporting. Call once at app startup.
 */
export function init(): void {
  sessionId = generateSessionId();

  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  const customDsn = import.meta.env.VITE_ERROR_REPORTING_DSN;

  if (sentryDsn) {
    // Lazy-load Sentry to keep the main bundle small when not needed
    useSentry = true;
    import('@sentry/react')
      .then((Sentry) => {
        Sentry.init({
          dsn: sentryDsn,
          release: getRelease(),
          environment: import.meta.env.MODE,
        });
        // eslint-disable-next-line no-console
        console.log('[ErrorReporting] Sentry SDK initialized');
      })
      .catch(() => {
        // Sentry package not installed — fall back to custom reporter
        useSentry = false;
        dsn = customDsn ?? null;
        // eslint-disable-next-line no-console
        console.warn(
          '[ErrorReporting] @sentry/react not installed; falling back to custom reporter',
        );
      });
  } else if (customDsn) {
    dsn = customDsn;
    // eslint-disable-next-line no-console
    console.log('[ErrorReporting] Initialized with DSN endpoint');
  } else {
    // eslint-disable-next-line no-console
    console.log('[ErrorReporting] No DSN configured — errors will be logged to console only');
  }

  // Periodic batch flush
  flushTimer = setInterval(flush, BATCH_FLUSH_INTERVAL_MS);

  // Flush on page hide / unload
  const flushOnExit = () => flush();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnExit();
  });
  window.addEventListener('pagehide', flushOnExit);
}

/**
 * Capture an error with optional context. The error is batched and will be
 * sent to the configured DSN (or Sentry) on the next flush cycle.
 */
export function captureError(error: Error, context?: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.error('[ErrorReporting]', error.message, context);

  // Delegate to Sentry when available
  if (useSentry) {
    import('@sentry/react')
      .then((Sentry) => {
        Sentry.captureException(error, { extra: context });
      })
      .catch(() => {
        // Sentry not available — queue for custom reporter
        enqueueError(error, context);
      });
    return;
  }

  enqueueError(error, context);
}

function enqueueError(error: Error, context?: Record<string, unknown>): void {
  const entry: ErrorEntry = {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    userId: currentUser,
    sessionId,
    release: getRelease(),
    breadcrumbs: [...breadcrumbs],
  };

  errorBuffer.push(entry);

  if (errorBuffer.length >= MAX_BATCH_SIZE) {
    flush();
  }
}

/**
 * Set the current user context. Included with all subsequent error reports.
 */
export function setUser(userId: string): void {
  currentUser = userId;

  if (useSentry) {
    import('@sentry/react')
      .then((Sentry) => {
        Sentry.setUser({ id: userId });
      })
      .catch(() => { /* noop */ });
  }

  // eslint-disable-next-line no-console
  console.log(`[ErrorReporting] User context set: ${userId}`);
}

// ---------------------------------------------------------------------------
// Breadcrumb helpers — call these from integration points
// ---------------------------------------------------------------------------

/**
 * Record a navigation breadcrumb (called from React Router integration).
 */
export function addNavigationBreadcrumb(from: string, to: string): void {
  addBreadcrumb({
    type: 'navigation',
    message: `${from} → ${to}`,
    timestamp: new Date().toISOString(),
    data: { from, to },
  });
}

/**
 * Record an API call breadcrumb (called from Axios interceptor).
 */
export function addApiBreadcrumb(
  method: string,
  url: string,
  status?: number,
  durationMs?: number,
): void {
  addBreadcrumb({
    type: 'api',
    message: `${method.toUpperCase()} ${url} → ${status ?? '?'}`,
    timestamp: new Date().toISOString(),
    data: { method, url, status, durationMs },
  });
}

/**
 * Record a console error breadcrumb.
 */
export function addConsoleBreadcrumb(message: string): void {
  addBreadcrumb({
    type: 'console',
    message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Record a generic custom breadcrumb.
 */
export function addCustomBreadcrumb(
  message: string,
  data?: Record<string, unknown>,
): void {
  addBreadcrumb({
    type: 'custom',
    message,
    timestamp: new Date().toISOString(),
    data,
  });
}

/**
 * Tear down the reporting service (useful for tests).
 */
export function destroy(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  errorBuffer.length = 0;
  breadcrumbs.length = 0;
  dsn = null;
  currentUser = null;
  sessionId = null;
  useSentry = false;
}
