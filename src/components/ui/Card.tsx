"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  onClick?: () => void;
}

/** A sheet of paper: solid surface, hairline border, soft warm shadow. `glow` marks the card that matters on the page. */
export default function Card({ children, className, hover = false, glow = false, onClick }: CardProps) {
  const interactive = hover || !!onClick;
  return (
    <div
      onClick={onClick}
      className={cn(
        "slide-up rounded-card border bg-sheet p-5 shadow-sheet sm:p-6",
        glow ? "border-pen/30" : "border-line",
        interactive && "cursor-pointer transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-4", className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("font-display text-lg font-semibold tracking-tight text-ink", className)}>{children}</h3>;
}

export function CardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mt-1 text-sm text-muted", className)}>{children}</p>;
}
