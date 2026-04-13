import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { init as initErrorReporting, captureError } from './services/errorReporting'

initErrorReporting()

window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
  captureError(error, { type: 'unhandledrejection' })
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
