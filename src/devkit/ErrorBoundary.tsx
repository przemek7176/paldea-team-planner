// src/devkit/ErrorBoundary.tsx
import React from "react";

type ErrorBoundaryProps = {
  children: React.ReactNode;
  /** Optional UI to show when an error occurs */
  fallback?: React.ReactNode;
  /** Called when the user clicks “Reload” on the fallback UI */
  onReset?: () => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
  info?: React.ErrorInfo;
};

export default class ErrorBoundary
  extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ error, info });
    // Optional: log to console or remote
    // eslint-disable-next-line no-console
    console.error("UI crashed:", error, info?.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, info: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div role="alert" className="p-4 border rounded-md bg-red-50 text-red-700">
          <h2 className="font-semibold mb-2">Something went wrong.</h2>
          {this.state.error?.message && (
            <pre className="whitespace-pre-wrap text-sm">
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-2 px-3 py-1 rounded-md border"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
