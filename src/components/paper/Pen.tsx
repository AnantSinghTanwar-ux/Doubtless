"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Text that writes itself out, left to right, once `on` is true. */
export function WriteOn({ children, on, delay = 0, duration = 1.2, className }: { children: ReactNode; on: boolean; delay?: number; duration?: number; className?: string }) {
  const style: CSSProperties = on
    ? { animation: `lp-write ${duration}s linear ${delay}s both` }
    : { clipPath: "inset(-10% 100% -10% 0)" };
  return (
    <span data-write className={cn("inline-block whitespace-nowrap", className)} style={style}>
      {children}
    </span>
  );
}

/** A red-pen tick that draws itself. */
export function Tick({ on, delay = 0, className }: { on: boolean; delay?: number; className?: string }) {
  return (
    <svg viewBox="0 0 40 32" className={cn("h-7 w-8 text-[#c8372d]", className)} fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" aria-label="correct">
      <path pathLength={1} className={cn("pen-draw", on && "on")} style={{ ["--delay" as string]: `${delay}s`, ["--dur" as string]: "0.5s" }} d="M4 17 L15 28 C20 16 28 8 37 3" />
    </svg>
  );
}

/** A red-pen cross that draws itself. */
export function Cross({ on, delay = 0, className }: { on: boolean; delay?: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7 text-[#c8372d]", className)} fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" aria-label="mistake">
      <path pathLength={1} className={cn("pen-draw", on && "on")} style={{ ["--delay" as string]: `${delay}s`, ["--dur" as string]: "0.35s" }} d="M5 5 L27 27" />
      <path pathLength={1} className={cn("pen-draw", on && "on")} style={{ ["--delay" as string]: `${delay + 0.3}s`, ["--dur" as string]: "0.35s" }} d="M27 5 L5 27" />
    </svg>
  );
}

/** A loose hand-drawn ring around whatever it wraps (e.g. a wrong answer). */
export function Circled({ children, on, delay = 0 }: { children: ReactNode; on: boolean; delay?: number }) {
  return (
    <span className="relative inline-block px-2">
      {children}
      <svg viewBox="0 0 200 60" preserveAspectRatio="none" className="pointer-events-none absolute -inset-x-1 -inset-y-1.5 h-[calc(100%+0.75rem)] w-[calc(100%+0.5rem)] text-[#c8372d]" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
        <path pathLength={1} className={cn("pen-draw", on && "on")} style={{ ["--delay" as string]: `${delay}s`, ["--dur" as string]: "0.8s" }} d="M100 5 C160 3 196 16 193 31 C190 48 140 57 95 56 C45 55 6 46 8 28 C10 12 50 5 108 6 C128 7 140 10 148 14" />
      </svg>
    </span>
  );
}

/** The teacher's total, circled in red. */
export function ScoreCircle({ value, max, on, delay = 0, className }: { value: number | string; max: number | string; on: boolean; delay?: number; className?: string }) {
  return (
    <div className={cn("relative grid size-32 place-items-center text-[#c8372d]", className)} role="img" aria-label={`Score ${value} out of ${max}`}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full -rotate-6" fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round">
        <path pathLength={1} className={cn("pen-draw", on && "on")} style={{ ["--delay" as string]: `${delay}s`, ["--dur" as string]: "0.9s" }} d="M100 12C160 10 192 52 188 104C184 158 140 192 92 188C40 184 10 146 14 94C18 44 56 14 112 16C128 17 142 22 150 28" />
      </svg>
      <p className="hand relative leading-none" style={{ opacity: on ? 1 : 0, transition: `opacity 0.4s ease ${delay + 0.5}s` }}>
        <span className="text-5xl">{value}</span>
        <span className="text-2xl"> / {max}</span>
      </p>
    </div>
  );
}
