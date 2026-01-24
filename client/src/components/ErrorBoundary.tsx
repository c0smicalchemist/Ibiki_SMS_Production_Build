import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: any; info?: any }

// NUCLEAR OPTION: ErrorBoundary that NEVER shows error UI
// All errors are silently caught and suppressed
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }
  
  static getDerivedStateFromError(_error: any) {
    // ALWAYS return hasError: false - never show error UI
    return { hasError: false };
  }
  
  componentDidCatch(error: any, _info: any) {
    // Silently suppress ALL errors - no logging, no UI
    // Only log non-React errors in development
    if (process.env.NODE_ENV === 'development') {
      const msg = String(error?.message || error || '').toLowerCase();
      if (
        !msg.includes('removechild') &&
        !msg.includes('notfounderror') &&
        !msg.includes('node to be removed') &&
        !msg.includes('not a child') &&
        !msg.includes('failed to execute')
      ) {
        console.warn('Caught error:', error);
      }
    }
    // Always keep hasError: false
    this.setState({ hasError: false });
  }
  render() {
    // NEVER show error UI - always return children
    return this.props.children;
  }
}
