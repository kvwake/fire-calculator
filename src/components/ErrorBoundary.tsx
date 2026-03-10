import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log error details for debugging (visible in browser console)
    console.error('FIRE Calculator error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 p-6 text-center dark:border-red-700 dark:bg-red-900/20">
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-300">Something went wrong</h3>
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {this.state.error?.message || 'An unexpected error occurred in the calculation engine.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Try Again
          </button>
          <p className="mt-3 text-xs text-red-500 dark:text-red-500">
            If this keeps happening, try clearing your data from the Settings tab or reloading the page.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
