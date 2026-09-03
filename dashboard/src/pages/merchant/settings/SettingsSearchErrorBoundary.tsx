import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  resetKey: string;
  fallbackText: string;
  /** When true, occupy the settings card so a crash cannot look like a white page. */
  fullPage?: boolean;
};

type State = { error: Error | null };

/**
 * Search-driven rendering must never blank Settings.
 * Wrap the entire page (not only the listbox): a destination-tab throw used to
 * replace nav + content with a tiny dashed box.
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
          data-settings-search="stay-on-tab-v4"
          className={`rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-muted)]/40 px-4 py-8 text-center text-sm text-[var(--text-muted)] ${
            this.props.fullPage ? 'min-h-[60vh]' : ''
          }`}
        >
          {this.props.fallbackText}
        </div>
      );
    }
    return this.props.children;
  }
}
