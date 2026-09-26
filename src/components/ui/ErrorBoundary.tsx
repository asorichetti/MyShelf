import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorFallbackProps {
  error: Error;
  /** Where React was when it failed (component names), for the error details. */
  componentStack: string | null;
  /** Clears the error and renders the children again. */
  retry: () => void;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** What to show instead of children that threw while rendering. */
  fallback: (props: ErrorFallbackProps) => ReactNode;
  /** Told about each error caught (after React has shown the fallback). */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Told when the fallback's retry clears the error. */
  onRetry?: () => void;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

/**
 * Catches an error thrown while rendering its children (P09-04) and shows
 * `fallback` in their place, so one broken screen does not blank the app.
 * Errors in event handlers and promises are not render errors and pass by;
 * those are handled where they happen.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  override state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(thrown: unknown): Partial<State> {
    return { error: thrown instanceof Error ? thrown : new Error(String(thrown)) };
  }

  override componentDidCatch(thrown: unknown, info: ErrorInfo): void {
    const error = thrown instanceof Error ? thrown : new Error(String(thrown));
    this.setState({ componentStack: info.componentStack ?? null });
    this.props.onError?.(error, info);
  }

  retry = (): void => {
    this.props.onRetry?.();
    this.setState({ error: null, componentStack: null });
  };

  override render(): ReactNode {
    const { error, componentStack } = this.state;
    if (error) return this.props.fallback({ error, componentStack, retry: this.retry });
    return this.props.children;
  }
}
