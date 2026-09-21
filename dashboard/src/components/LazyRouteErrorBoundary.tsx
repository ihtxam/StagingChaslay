import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { isBrowserOnline } from '@/lib/webpos-offline/types';
import { isNetworkError } from '@/lib/webpos-offline/network';
import { looksLikeStaleBundleError, recoverStaleWebPosBundle } from '@/lib/pwa-recover';

type Props = {
  children: ReactNode;
  resetKey?: string;
};

type State = { error: Error | null; recovering: boolean };

function isLazyChunkLoadError(error: Error): boolean {
  return /Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    error.message
  );
}

function isOfflineLoadFailure(error: Error): boolean {
  if (!isBrowserOnline()) return true;
  if (isNetworkError(error)) return true;
  return isLazyChunkLoadError(error) && !isBrowserOnline();
}

/** Route-level boundary for lazy-loaded panel pages (Chaslay builder, etc.). */
class LazyRouteErrorBoundaryInner extends Component<
  Props & { t: (key: string) => string },
  State
> {
  state: State = { error: null, recovering: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidUpdate(prevProps: Props & { t: (key: string) => string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, recovering: false });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[lazy-route]', error, info.componentStack);
    if (isOfflineLoadFailure(error)) return;
    if (looksLikeStaleBundleError(error) && isBrowserOnline()) {
      this.setState({ recovering: true });
      void recoverStaleWebPosBundle(error.message).then((reloaded) => {
        if (!reloaded) this.setState({ recovering: false });
      });
    }
  }

  render() {
    const { children, t } = this.props;
    const { error, recovering } = this.state;
    if (!error) return children;

    if (recovering) {
      return (
        <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-sm font-medium text-stone-800">{t('loading')}</p>
        </div>
      );
    }

    if (isOfflineLoadFailure(error)) {
      return (
        <div
          role="alert"
          className="mx-4 my-6 flex max-w-lg flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-left"
        >
          <p className="text-base font-semibold text-stone-900">{t('webPosOfflinePinTitle')}</p>
          <p className="text-sm text-stone-700">{t('loginNetworkError')}</p>
          <button
            type="button"
            className="self-start rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            onClick={() => window.location.reload()}
          >
            {t('webPosOfflineRetry')}
          </button>
        </div>
      );
    }

    return (
      <div
        role="alert"
        className="mx-4 my-6 flex max-w-lg flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-left"
      >
        <p className="text-base font-semibold text-stone-900">{t('webPosLoadFailed')}</p>
        <p className="text-sm text-stone-700">{error.message || t('webPosLoadFailed')}</p>
        <button
          type="button"
          className="self-start rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          onClick={() => window.location.reload()}
        >
          {t('webPosOfflineRetry')}
        </button>
      </div>
    );
  }
}

export default function LazyRouteErrorBoundary({ children, resetKey }: Props) {
  const { t } = useI18n();
  return (
    <LazyRouteErrorBoundaryInner resetKey={resetKey} t={t}>
      {children}
    </LazyRouteErrorBoundaryInner>
  );
}
