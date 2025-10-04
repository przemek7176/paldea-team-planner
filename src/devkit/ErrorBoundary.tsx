import React from 'react'

type Props = {
  children: React.ReactNode
  /** When true (e.g., ?dev=1), render detailed diagnostics. */
  dev?: boolean
  /** Optional custom fallback node (used when dev !== true). */
  fallback?: React.ReactNode
}

type State = {
  hasError: boolean
  error?: Error
  info?: React.ErrorInfo
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ error, info })
    // You can add logging here if desired
    // console.error('App crashed:', error, info)
  }

  render() {
    const { hasError, error, info } = this.state
    const { dev, fallback } = this.props

    if (!hasError) return this.props.children

    if (dev) {
      return (
        <div style={{ padding: 16, fontFamily: 'ui-monospace, Menlo, Consolas' }}>
          <h2>💥 App crashed</h2>
          <p>{String(error?.message || error)}</p>
          <pre style={{ whiteSpace: 'pre-wrap', opacity: 0.8 }}>{error?.stack || ''}</pre>
          {info?.componentStack && (
            <>
              <h3>Component stack</h3>
              <pre style={{ whiteSpace: 'pre-wrap', opacity: 0.8 }}>{info.componentStack}</pre>
            </>
          )}
          <button onClick={() => location.reload()}>Reload</button>
        </div>
      )
    }

    return (
      fallback ?? (
        <div role="alert" className="p-4 rounded border bg-red-50 text-red-700">
          Something went wrong. Please reload the page.
        </div>
      )
    )
  }
}
