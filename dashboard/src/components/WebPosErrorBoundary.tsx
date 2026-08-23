import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };

type State = { error: Error | null };

/** Catches WebPOS render crashes so staff see a recovery screen instead of a blank page. */
export default class WebPosErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[WebPOS]', error, info.componentStack);
  }

  private hardReload = () => {
    try {
      sessionStorage.setItem('webpos_recover_reload', String(Date.now()));
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-stone-100 px-6 text-center">
        <div className="max-w-md space-y-2">
          <h1 className="text-lg font-bold text-stone-900">WebPOS failed to load</h1>
          <p className="text-sm text-stone-600">
            The register screen hit an error. Reload the page — if you use the installed app, close
            it fully and open again so the latest version downloads.
          </p>
          {import.meta.env.DEV ? (
            <pre className="max-h-32 overflow-auto rounded-lg bg-white p-3 text-left text-xs text-red-800">
              {this.state.error.message}
            </pre>
          ) : null}
        </div>
        <button
          type="button"
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          onClick={this.hardReload}
        >
          Reload WebPOS
        </button>
      </div>
    );
  }
}
