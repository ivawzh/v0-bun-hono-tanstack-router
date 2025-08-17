import React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 React Error Boundary caught an error:', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorInfo: {
        componentStack: errorInfo.componentStack,
      },
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    });

    // Skip toast for AbortError - these are normal request cancellations
    if (error.name !== 'AbortError' && !error.message.includes('aborted')) {
      toast.error('Application Error', {
        description: `${error.name}: ${error.message}`,
        action: {
          label: 'View Details',
          onClick: () => {
            console.group('🚨 Error Boundary Details');
            console.error('Error:', error);
            console.error('Error Info:', errorInfo);
            console.groupEnd();
          }
        }
      });
    }

    this.setState({
      hasError: true,
      error,
      errorInfo,
    });
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const { error } = this.state;
      
      // For AbortError, just reset silently instead of showing error UI
      if (error?.name === 'AbortError' || error?.message.includes('aborted')) {
        setTimeout(() => this.resetError(), 0);
        return this.props.children;
      }
      
      if (this.props.fallback) {
        const Fallback = this.props.fallback;
        return <Fallback error={error!} resetError={this.resetError} />;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="flex justify-center">
              <AlertTriangle className="h-16 w-16 text-red-500" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900">Something went wrong</h1>
              <p className="text-gray-600">
                An unexpected error occurred while rendering this page.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left">
                <div className="font-mono text-sm">
                  <div className="font-semibold text-red-800">{error.name}</div>
                  <div className="text-red-700 mt-1">{error.message}</div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button onClick={this.resetError} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button 
                onClick={() => window.location.reload()} 
                variant="default"
              >
                Reload Page
              </Button>
            </div>

            <p className="text-xs text-gray-500 mt-4">
              Error details have been logged to the console for debugging.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};