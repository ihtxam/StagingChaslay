import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportClientError } from '@/lib/client-error-report';
import {
  isStandalonePwaSession,
  looksLikeStaleBundleError,
  recoverStaleWebPosBundle,
} from '@/lib/pwa-recover';

type Props = { children: ReactNode };

type State = { error: Error | null; recovering: boolean };

/** Catches WebPOS render crashes so staff see a recovery screen instead of a blank page. */
export default class WebPosErrorBoundary extends Component<Props, State> {
  state: State = { error: null, recovering: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[WebPOS]', error, info.componentStack);
    reportClientError(error, {
      source: 'WebPosErrorBoundary',
      metadata: {
        componentStack: info.componentStack,
        standalonePwa: isStandalonePwaSession(),
      },
    });

    if (looksLikeStaleBundleError(error)) {
      this.setState({ recovering: true });
      void recoverStaleWebPosBundle(error.message).then((reloaded) => {
        if (!reloaded) this.setState({ recovering: false });
      });
    }
  }

  private hardReload = () => {
    try {
      sessionStorage.setItem('webpos_recover_reload', String(Date.now()));
    } catch {
      /* ignore */
    }
    void recoverStaleWebPosBundle('manual-reload').finally(() => {
      window.location.reload();
    });
  };

  render() {
    if (!this.state.error) return this.props.children;

    if (this.state.recovering) {
      return (
        <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-stone-100 px-6 text-center">
          <p className="text-sm font-medium text-stone-700">Updating WebPOS…</p>
          <p className="max-w-md text-xs text-stone-500">
            Downloading the latest version for your installed app.
          </p>
        </div>
      );
    }

    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-stone-100 px-6 text-center">
        <div className="max-w-md space-y-2">
          <h1 className="text-lg font-bold text-stone-900">WebPOS failed to load</h1>
          <p className="text-sm text-stone-600">
            The register screen hit an error. Reload the page — if you use the installed app, close
            it fully and open again so the latest version downloads.
          </p>
          <p className="rounded-lg bg-white px-3 py-2 text-left text-xs text-red-800">
            {this.state.error.message || 'Unknown error'}
          </p>
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
