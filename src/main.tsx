import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import ErrorBoundary from './devkit/ErrorBoundary'

const isDevKit = new URLSearchParams(location.search).get('dev') === '1'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary dev={isDevKit}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
