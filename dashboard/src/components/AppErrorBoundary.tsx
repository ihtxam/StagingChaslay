import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };

type State = { error: Error | null };

/**
 * Root boundary so a page render throw cannot unmount #root.
 * Nested settings boundaries still handle local section failures.
 */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[app]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        data-app-error-boundary="root"
        role="alert"
        className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-stone-50 px-6 text-center"
      >
        <p className="text-base font-semibold text-stone-900">This page hit an error</p>
        <p className="max-w-md text-sm text-stone-600">
          Reload to continue. Settings and POS should still be reachable after a refresh.
        </p>
        <p className="max-w-lg rounded-md bg-white px-3 py-2 text-left text-xs text-red-800">
          {this.state.error.message || 'Unknown error'}
        </p>
        <button
          type="button"
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }
}
