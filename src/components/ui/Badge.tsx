"use client";

import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info";
  className?: string;
}

export default function Badge({ children, variant = "default", className }: BadgeProps) {
  const variants = {
    default: "bg-ink/[0.06] text-muted border-line",
    success: "bg-emerald-600/10 text-emerald-700 border-emerald-700/25",
    warning: "bg-amber-500/15 text-amber-800 border-amber-700/25",
    error: "bg-margin/10 text-[#a82014] border-margin/30",
    info: "bg-pen/10 text-pen-deep border-pen/25",
  };

  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
}
