"use client";

import { BadgeCheck, BookOpen, Sparkles, Video } from "lucide-react";
import { useInView } from "./Reveal";

/** An illustrative product window: a doubt goes in, gets routed, and an explanation streams out. It plays once when scrolled into view. */
export default function HeroPreview() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const run = inView ? "" : "opacity-0";

  return (
    <div ref={ref} className="overflow-hidden rounded-card border border-line-strong bg-sheet shadow-lift">
      <div className="flex items-center justify-between border-b border-line bg-sunk px-4 py-2.5">
        <span className="text-sm font-medium text-muted">Ask a doubt</span>
        <span className="flex items-center gap-1.5 text-xs text-faint">
          <BadgeCheck className="h-3.5 w-3.5 text-pen" aria-hidden /> Verified teachers online
        </span>
      </div>

      <div className="grid gap-5 p-5 text-left sm:p-6 md:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <div className={`${inView ? "lp-rise" : ""} ${run} ml-auto max-w-[90%] rounded-2xl rounded-br-md bg-ink px-4 py-3 text-[15px] text-snow`} style={{ animationDelay: "0.1s" }}>
            Why is acceleration still 9.8 m/s² at the top of a throw, if the ball has stopped?
          </div>

          <div className={`${inView ? "lp-rise" : ""} ${run} rounded-xl border border-line bg-paper p-4`} style={{ animationDelay: "0.9s" }}>
            <p className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
              <Sparkles className="h-4 w-4 text-pen" aria-hidden /> Doubt router
            </p>
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-md border border-line bg-sheet px-2.5 py-1 text-ink">Physics, Kinematics</span>
              <span className="rounded-md border border-amber-700/25 bg-amber-500/15 px-2.5 py-1 text-amber-800">Concept gap</span>
            </div>
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>Confidence</span>
              <span className="tabular">82%</span>
            </div>
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-ink/10">
              <div className={`${inView ? "lp-fill" : ""} h-full rounded-full bg-pen`} style={{ ["--w" as string]: "82%", animationDelay: "1.4s", width: inView ? undefined : 0 }} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <span className={`${inView ? "lp-pop" : ""} ${run} rounded-lg border border-pen bg-pen-wash py-2 font-medium text-pen-deep`} style={{ animationDelay: "1.9s" }}>
                AI explain
              </span>
              <span className="rounded-lg border border-line py-2 text-faint">Practice</span>
              <span className="rounded-lg border border-line py-2 text-faint">Teacher</span>
            </div>
          </div>
        </div>

        <div className={`${inView ? "lp-rise" : ""} ${run} rounded-xl border border-line bg-paper p-5`} style={{ animationDelay: "2.3s" }}>
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
            <BookOpen className="h-4 w-4 text-pen" aria-hidden /> Explanation
          </p>
          <p className="text-[15px] leading-7 text-ink/85">
            At the peak the <mark className="rounded bg-pen/15 px-1 text-pen-deep">velocity</mark> is momentarily zero, but gravity never stops pulling. Acceleration depends on the force, not on how fast the ball is moving right now
            <span className="lp-caret ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-pen" aria-hidden />
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-line px-3 py-1 text-muted">From your notes, p.14</span>
            <span className="flex items-center gap-1.5 rounded-full border border-pen/30 bg-pen-wash px-3 py-1 text-pen-deep">
              <Video className="h-3 w-3" aria-hidden /> Still stuck? Ask a teacher
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
