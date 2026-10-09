"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, BookOpen, Sparkles, TrendingUp, Video } from "lucide-react";

/** An illustrative product window. It tilts back at the top of the page and settles flat as you scroll. */
export default function HeroPreview() {
  const [p, setP] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    const update = () => {
      frame.current = 0;
      setP(Math.min(1, window.scrollY / 420));
    };
    const onScroll = () => {
      if (!frame.current) frame.current = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame.current);
    };
  }, []);

  return (
    <div className="relative mx-auto mt-20 max-w-5xl px-2 [perspective:1600px]">
      <div className="lp-glow absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[3rem] bg-violet-600/[0.09] blur-[90px]" />

      {/* floating chips */}
      <div className="lp-float absolute -left-4 -top-5 z-20 hidden items-center gap-2 rounded-xl border border-white/10 bg-[#fffdf8]/90 px-3.5 py-2.5 text-sm shadow-xl backdrop-blur lg:flex">
        <TrendingUp className="h-4 w-4 text-violet-300" />
        <span className="text-zinc-200">Mastery trending up</span>
      </div>
      <div className="lp-float absolute -bottom-5 -right-4 z-20 hidden items-center gap-2 rounded-xl border border-white/10 bg-[#fffdf8]/90 px-3.5 py-2.5 text-sm shadow-xl backdrop-blur lg:flex" style={{ animationDelay: "-3s" }}>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
          <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="text-zinc-200">Verified teacher online</span>
        <BadgeCheck className="h-4 w-4 fill-violet-500 text-[#fffdf8]" />
      </div>

      <div
        className="overflow-hidden rounded-2xl border border-white/10 bg-[#fffdf8] shadow-[0_40px_120px_-30px_rgba(194, 65, 12,0.5)]"
        style={{ transform: `rotateX(${16 * (1 - p)}deg) scale(${0.92 + 0.08 * p})`, transformOrigin: "50% 0%", transition: "transform 120ms ease-out" }}
      >
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 font-mono text-xs text-zinc-500">Doubtless · Ask a doubt</span>
        </div>

        <div className="grid gap-5 p-5 text-left sm:p-7 md:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4">
            <div className="lp-rise ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-violet-600/90 px-4 py-3 text-[15px] text-white" style={{ animationDelay: "0.8s" }}>
              Why is acceleration still 9.8 m/s² at the top of a throw, if the ball has stopped?
            </div>

            <div className="lp-rise rounded-2xl border border-white/10 bg-[#fffdf8]/75 p-4" style={{ animationDelay: "1.6s" }}>
              <p className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-violet-300">
                <Sparkles className="h-3.5 w-3.5" /> Doubt router
              </p>
              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-lg border border-white/10 bg-[#fffdf8]/75 px-2.5 py-1 text-zinc-200">Physics · Kinematics</span>
                <span className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-amber-200">concept gap</span>
              </div>
              <div className="mb-1 flex justify-between font-mono text-[11px] text-zinc-500">
                <span>CONFIDENCE</span>
                <span>0.82</span>
              </div>
              <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="lp-fill h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400" style={{ ["--w" as string]: "82%", animationDelay: "2.1s" }} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <span className="lp-pop rounded-lg border border-violet-400/50 bg-violet-500/20 py-2 font-medium text-violet-100" style={{ animationDelay: "2.6s" }}>AI explain</span>
                <span className="rounded-lg border border-white/10 py-2 text-zinc-500">Practice</span>
                <span className="rounded-lg border border-white/10 py-2 text-zinc-500">Teacher</span>
              </div>
            </div>
          </div>

          <div className="lp-rise rounded-2xl border border-white/10 bg-[#fffdf8]/55 p-5" style={{ animationDelay: "3.1s" }}>
            <p className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              <BookOpen className="h-3.5 w-3.5" /> Explanation
            </p>
            <p className="text-[15px] leading-7 text-zinc-300">
              At the peak the <span className="rounded bg-violet-500/20 px-1 text-violet-200">velocity</span> is momentarily zero, but gravity never stops pulling. Acceleration depends on the force, not on how fast the ball is moving right now
              <span className="lp-caret ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-violet-300" />
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/10 px-3 py-1 text-zinc-400">From your notes · p.14</span>
              <span className="flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-violet-200">
                <Video className="h-3 w-3" /> Still stuck? Ask a teacher
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
