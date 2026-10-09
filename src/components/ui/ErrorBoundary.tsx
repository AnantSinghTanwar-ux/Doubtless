"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
          <div className="max-w-lg rounded-card border border-margin/30 bg-sheet p-8 shadow-lift" role="alert">
            <h1 className="mb-2 font-display text-2xl font-semibold text-ink">Something went wrong</h1>
            <p className="mb-6 text-sm text-muted">{this.state.error?.message || "An unexpected error occurred."}</p>
            <button
              className="rounded-[10px] bg-ink px-6 py-2.5 text-sm font-medium text-snow transition-colors hover:bg-[#1f3159]"
              onClick={() => this.setState({ hasError: false })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
