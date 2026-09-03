import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  resetKey: string;
  fallbackText: string;
  /** @deprecated Nav/search stay outside this boundary so a crash cannot white-out the page. */
  fullPage?: boolean;
};

type State = { error: Error | null };

/**
 * Only wrap the tab panel. Title, search, results list, and tab nav stay mounted
 * so a destination-tab throw cannot become a blank page.
 */
export default class SettingsSearchErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[settings-search]', error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          data-settings-search="search-click-v7"
          role="alert"
          className="min-h-[12rem] rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-muted)]/40 px-4 py-8 text-center text-sm text-[var(--text)]"
        >
          {this.props.fallbackText}
        </div>
      );
    }
    return this.props.children;
  }
}
