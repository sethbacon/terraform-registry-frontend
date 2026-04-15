import React from 'react'
import ReactDOM from 'react-dom/client'
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
