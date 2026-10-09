"use client";

import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info";
  className?: string;
}

export default function Badge({ children, variant = "default", className }: BadgeProps) {
  const variants = {
    default: "bg-white/10 text-gray-300 border-white/10",
    success: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
    warning: "bg-amber-400/10 text-amber-400 border-amber-400/20",
    error: "bg-red-400/10 text-red-400 border-red-400/20",
    info: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
