/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
  readonly VITE_API_URL?: string
  readonly VITE_USE_MOCK_DATA?: string
  readonly VITE_ERROR_REPORTING_DSN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
