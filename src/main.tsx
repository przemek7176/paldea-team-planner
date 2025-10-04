import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import ErrorBoundary from './devkit/ErrorBoundary'

// Standardize on `?dev=1` for DevKit
const isDevKit = new URLSearchParams(location.search).get('dev') === '1'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Keep the boundary always — verbose diagnostics only when ?dev=1 */}
    <ErrorBoundary dev={isDevKit}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
