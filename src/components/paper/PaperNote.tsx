import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A small taped-on scrap of paper with a handwritten line, for scattering around hero areas. */
export default function PaperNote({ children, rotate = -4, className, ink = "blue" }: { children: ReactNode; rotate?: number; className?: string; ink?: "blue" | "red" }) {
  return (
    <div className={cn("lp-float", className)}>
      <div className="paper paper-plain relative w-52 px-5 py-5 shadow-2xl" style={{ transform: `rotate(${rotate}deg)` }}>
        <span aria-hidden className="absolute -top-3 left-1/2 h-6 w-16 -translate-x-1/2 bg-[#f1d58a]/85 shadow-sm" style={{ ["--r" as string]: "-3deg", animation: "tape-in 0.8s ease both", transform: "rotate(-3deg)" }} />
        <p className={cn("hand text-[1.7rem] leading-[1.15]", ink === "red" ? "ink-red" : "ink-blue")}>{children}</p>
      </div>
    </div>
  );
}
