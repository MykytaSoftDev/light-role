"use client";

import React from "react";
import * as Sentry from "@sentry/nextjs";

// i18n note: this is a class-component error boundary; React class components
// can't use the useTranslations hook. The `message` and `retryLabel` props
// are the supported translation seam — parents should pass translated strings
// (analytics.error_boundary_message / analytics.error_boundary_retry).

interface State {
  hasError: boolean;
}

interface Props {
  children: React.ReactNode;
  message?: string;
  retryLabel?: string;
}

export class AnalyticsErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, {
      tags: { component: "analytics" },
      extra: { componentStack: info.componentStack },
    });
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      const message =
        this.props.message ??
        "Something went wrong loading your analytics. We\u2019ve been notified.";
      const retryLabel = this.props.retryLabel ?? "Try again";

      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center p-6">
          <p className="text-muted-foreground">{message}</p>
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {retryLabel}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
