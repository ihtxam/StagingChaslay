import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  resetKey: string;
  fallbackText: string;
};

type State = { error: Error | null };

/**
 * Search-driven tab/results rendering must never blank the Settings page.
 * A bad query (second word, trailing space, regex-ish input) can throw in
 * highlight/list rendering; catch it and show an empty state instead.
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
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-muted)]/40 px-4 py-6 text-center text-sm text-[var(--text-muted)]">
          {this.props.fallbackText}
        </div>
      );
    }
    return this.props.children;
  }
}
