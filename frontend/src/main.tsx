import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'
import './i18n'
import { captureError } from './services/errorReporting'

// Error/performance reporting are started by <TelemetryGate> once the user has
// opted in (PRIVACY.md section 3.3) -- not here, unconditionally, before any
// consent state is even known. captureError() below is still safe to call
// pre-consent: it always logs to the console, but only transmits externally
// once init() has set a DSN, which happens exclusively via that opt-in gate.
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
  captureError(error, { type: 'unhandledrejection' })
})

// @axe-core/react stays a devDependency deliberately -- it's genuinely dev-only
// tooling. Guarding the import with import.meta.env.DEV lets `vite build` in
// production mode dead-code-eliminate this whole branch (verified: `vite build`
// succeeds even with @axe-core/react absent from node_modules), so unlike a
// Sentry-style runtime-conditional import this one is safe under a hypothetical
// `npm ci --omit=dev` before the Docker image's `vite build` step (see #610).
// It is NOT safe for `tsc` (the "build" npm script's type-check step, and any
// standalone typecheck/lint job): tsc still needs to resolve the module's type
// declarations regardless of runtime reachability, so devDependencies must stay
// installed for any job that runs `tsc`.
if (import.meta.env.DEV) {
  import('@axe-core/react').then((axe) => {
    axe.default(React, ReactDOM, 1000)
  })
}

// Read CSP nonce from meta tag (injected by nginx sub_filter)
const nonceMeta = document.querySelector('meta[name="csp-nonce"]')
const nonce = nonceMeta?.getAttribute('content') || undefined
// In production, __CSP_NONCE__ is replaced with the actual request_id by nginx.
// In development, it stays as the literal string, so we treat it as absent.
const resolvedNonce = nonce && nonce !== '__CSP_NONCE__' ? nonce : undefined

const emotionCache = createCache({
  key: 'css',
  nonce: resolvedNonce,
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CacheProvider value={emotionCache}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </CacheProvider>
  </React.StrictMode>,
)
