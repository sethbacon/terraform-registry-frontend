import React from 'react'
import ReactDOM from 'react-dom/client'
import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import App from './App'
import './index.css'
import { init as initErrorReporting, captureError } from './services/errorReporting'
import { init as initPerformanceReporting } from './services/performanceReporting'

initErrorReporting()
initPerformanceReporting()

window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
  captureError(error, { type: 'unhandledrejection' })
})

if (import.meta.env.DEV) {
  import('@axe-core/react').then(axe => {
    axe.default(React, ReactDOM, 1000);
  });
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
      <App />
    </CacheProvider>
  </React.StrictMode>
)
