"use client";

import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 active:scale-[0.98] hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#f7f4ec] disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-white text-zinc-950 hover:bg-zinc-200 focus:ring-white/40 shadow-lg shadow-white/5",
    secondary:
      "bg-white/5 text-white border border-white/10 hover:bg-white/10 focus:ring-white/20",
    ghost: "text-gray-400 hover:text-white hover:bg-white/5 focus:ring-white/20",
    danger:
      "bg-gradient-to-r from-red-500 to-rose-600 text-snow hover:from-red-600 hover:to-rose-700 focus:ring-red-500",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm gap-1.5",
    md: "px-5 py-2.5 text-sm gap-2",
    lg: "px-7 py-3 text-base gap-2.5",
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
