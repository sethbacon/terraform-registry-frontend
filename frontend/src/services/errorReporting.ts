let dsn: string | null = null;
let currentUser: string | null = null;

export function init(): void {
  const configuredDsn = import.meta.env.VITE_ERROR_REPORTING_DSN;
  if (configuredDsn) {
    dsn = configuredDsn;
    console.log('[ErrorReporting] Initialized with DSN endpoint');
  } else {
    console.log('[ErrorReporting] No DSN configured — errors will be logged to console only');
  }
}

export function captureError(error: Error, context?: Record<string, unknown>): void {
  console.error('[ErrorReporting]', error.message, context);

  if (dsn) {
    fetch(dsn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        ...(currentUser ? { userId: currentUser } : {}),
      }),
    }).catch(() => {});
  }
}

export function setUser(userId: string): void {
  currentUser = userId;
  console.log(`[ErrorReporting] User context set: ${userId}`);
}
