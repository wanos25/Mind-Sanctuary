import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { captureGlobalError } from '@/lib/observability/globalErrors';
import { trackProductEvent } from '@/lib/observability/productTelemetry';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Optional label that appears in console + structured telemetry for triage. */
  label?: string;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/**
 * Generic, theme-aware error boundary.
 * Append-only safety net — never alters child behavior on the happy path.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureGlobalError({
      kind: 'react-boundary',
      message: error.message,
      stack: error.stack,
      scope: this.props.label ?? 'unknown',
      componentStack: info.componentStack ?? undefined,
    });
    trackProductEvent('app.error_boundary', { label: this.props.label ?? 'unknown' });
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', {
      label: this.props.label ?? 'unknown',
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="min-h-[40vh] flex items-center justify-center p-6" role="alert" aria-live="assertive">
        <Card className="max-w-md w-full p-6 space-y-4 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Something went wrong</h2>
            <p className="text-xs text-muted-foreground break-words">{error.message}</p>
          </div>
          <Button onClick={this.reset} size="sm" variant="outline">
            <RefreshCw className="w-3.5 h-3.5 me-2" />
            Try again
          </Button>
        </Card>
      </div>
    );
  }
}

export default ErrorBoundary;
