/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
  readonly VITE_API_URL?: string
  readonly VITE_USE_MOCK_DATA?: string
  readonly VITE_ERROR_REPORTING_DSN?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_PERFORMANCE_DSN?: string
  // Comma-separated extra origins that isSafeExternalUrl() will treat as
  // in-app. Read in utils/externalUrl.ts and documented in README.md and
  // SECURITY.md; without it here, import.meta.env access to it was untyped, so
  // a typo in the NAME degraded silently to undefined -- which this variable
  // reads as "no extra origins allowed" rather than as a configuration error.
  readonly VITE_ALLOWED_EXTERNAL_ORIGINS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
