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
        <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-lg">
            <span className="text-6xl mb-4 block">🚨</span>
            <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-gray-400 text-sm mb-6">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              className="bg-red-500 hover:bg-red-600 text-snow px-6 py-2 rounded-lg font-medium transition-colors"
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
