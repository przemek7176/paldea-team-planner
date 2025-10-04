import React, { ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  /** When true (e.g., ?dev=1), show detailed diagnostics. */
  dev?: boolean;
  /** Optional custom fallback node. */
  fallback?: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
  info?: React.ErrorInfo;
};

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (this.props.dev) {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error, info);
    }
    this.setState({ info });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      if (this.props.dev) {
        return (
          <div className="p-4 rounded border border-red-200 bg-red-50 text-red-700">
            <div className="font-semibold">Something went wrong.</div>
            <pre className="text-xs mt-2 whitespace-pre-wrap">
              {this.state.error?.message}
              {'\n'}
              {this.state.info?.componentStack}
            </pre>
          </div>
        );
      }

      return (
        <div role="alert" className="p-4 rounded border bg-red-50 text-red-700">
          Something went wrong. Please reload the page.
        </div>
      );
    }
    return this.props.children;
  }
}