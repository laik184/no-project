/**
 * client/src/components/ui/error-boundary.tsx
 *
 * React Error Boundary — catches render errors and shows a friendly fallback
 * instead of a blank white screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary fallback={<p>Custom fallback</p>}>
 *     <SomeComponent />
 *   </ErrorBoundary>
 */

import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children:  ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError:   boolean;
  errorTitle: string;
  errorMsg:   string;
  errorId:    string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorTitle: '', errorMsg: '', errorId: '' };
  }

  static getDerivedStateFromError(err: Error): Partial<State> {
    return {
      hasError:   true,
      errorTitle: 'An unexpected error occurred',
      errorMsg:   err?.message ?? 'Unknown render error',
      errorId:    crypto.randomUUID?.() ?? String(Date.now()),
    };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Render error:', err, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        role="alert"
        style={{
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          justifyContent:'center',
          padding:       '32px 16px',
          textAlign:     'center',
          color:         '#e5e7eb',
          background:    '#0f172a',
          borderRadius:  8,
          border:        '1px solid #1f2937',
          gap:           12,
        }}
      >
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{this.state.errorTitle}</div>
        <div style={{ fontSize: 13, color: '#9ca3af', maxWidth: 400 }}>
          {this.state.errorMsg}
        </div>
        <div style={{ fontSize: 11, color: '#4b5563' }}>
          Error ID: {this.state.errorId}
        </div>
        <button
          onClick={() => this.setState({ hasError: false, errorTitle: '', errorMsg: '', errorId: '' })}
          style={{
            marginTop:    8,
            padding:      '6px 16px',
            fontSize:     12,
            borderRadius: 6,
            border:       '1px solid #374151',
            background:   '#1f2937',
            color:        '#e5e7eb',
            cursor:       'pointer',
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}
