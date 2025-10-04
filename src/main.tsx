import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { AppErrorBoundary } from './devkit/ErrorBoundary'

const dev = /\bdev=1\b/.test(location.search)
ReactDOM.createRoot(document.getElementById('root')!).render(
  dev ? (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  ) : (
    <App />
  )
)
