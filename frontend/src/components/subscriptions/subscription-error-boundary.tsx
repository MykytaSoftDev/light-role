"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class SubscriptionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Subscription Error Boundary caught an error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      // i18n note: class component can't use the useTranslations hook —
      // strings here would need to be threaded in via props from a parent.
      // Accepting the limitation for now; English copy stays inline.
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-6 p-8">
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <AlertTriangle className="text-destructive h-16 w-16" />
            </div>
            <h2 className="text-foreground text-2xl font-semibold">Something went wrong</h2>
            <p className="text-muted-foreground max-w-md">
              We encountered an error while loading your subscription details. This might be a
              temporary issue with our payment provider.
            </p>
            {this.state.error && (
              <div className="text-muted-foreground bg-muted rounded-md p-3 text-sm">
                <strong>Error:</strong> {this.state.error.message}
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <Button onClick={this.handleRetry} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
