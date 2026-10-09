"use client";

import Link from "next/link";
import { ArrowRight, Camera, ListChecks, PencilLine } from "lucide-react";
import { Reveal, WordReveal, useInView } from "./Reveal";
import { Circled, Cross, ScoreCircle, Tick, WriteOn } from "@/components/paper/Pen";

const STEP = 1.7; // seconds per written line

const POINTS = [
  { icon: Camera, title: "Snap it or type it", body: "Photograph your handwritten working, or type your steps." },
  { icon: ListChecks, title: "Checked step by step", body: "Every line is marked, and the first wrong step is pinpointed." },
  { icon: PencilLine, title: "Marks that explain themselves", body: "See exactly where marks were lost, with the fix written beside it." },
];

/** A student's handwritten answer being marked in red pen, the way a teacher would. */
function MarkedSheet() {
  const { ref, inView: on } = useInView<HTMLDivElement>(0.35);
  const t = (i: number) => 0.6 + i * STEP;

  return (
    <div ref={ref} className="paper mx-auto w-full max-w-xl -rotate-1 pb-8 pl-[4.6rem] pr-6 pt-[2.1rem] sm:rotate-[-1.5deg]">
      <p className="serif paper-line text-[15px] font-semibold text-[#1b2440]">
        Q3 &nbsp;[4 marks] &nbsp;A 2 kg block starts from rest and accelerates at 3 m/s². Find its kinetic energy after 4 s.
      </p>

      <div className="hand ink-blue text-[1.65rem] paper-line">
        <div className="flex items-center justify-between gap-3">
          <WriteOn on={on} delay={t(0)} duration={1.3}>Given: m = 2 kg, a = 3 m/s², t = 4 s</WriteOn>
          <Tick on={on} delay={t(0) + 1.3} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <WriteOn on={on} delay={t(1)} duration={1.3}>v = u + at = 0 + 3 × 4 = 12 m/s</WriteOn>
          <Tick on={on} delay={t(1) + 1.3} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <WriteOn on={on} delay={t(2)} duration={0.9}>KE = ½ m v²</WriteOn>
          <Tick on={on} delay={t(2) + 0.9} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="whitespace-nowrap">
            <WriteOn on={on} delay={t(3)} duration={1.2}>
              KE = ½ × 2 × 12² =&nbsp;
            </WriteOn>
            <Circled on={on} delay={t(3) + 1.3}>
              <WriteOn on={on} delay={t(3) + 1.1} duration={0.5}>24 joules</WriteOn>
            </Circled>
          </span>
          <Cross on={on} delay={t(3) + 1.4} />
        </div>
      </div>

      {/* The teacher's red pen: the note and the corrected line */}
      <div className="hand ink-red paper-line text-[1.55rem]" style={{ opacity: on ? 1 : 0, transition: `opacity 0.3s ease ${t(4) - 0.4}s` }}>
        <WriteOn on={on} delay={t(4) - 0.4} duration={1.2}>↑ 12² = 144, not 24!</WriteOn>
        <br />
        <WriteOn on={on} delay={t(5) - 0.5} duration={1.2}>KE = ½ × 2 × 144 = 144 joules</WriteOn>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <p
          className="hand ink-red text-xl leading-tight"
          style={{ opacity: on ? 1 : 0, transform: on ? "none" : "translateY(6px)", transition: `all 0.5s ease ${t(6) + 0.4}s` }}
        >
          First slip at step 4.
          <br />
          Method is right. Check your squares!
        </p>
        <ScoreCircle value={3} max={4} on={on} delay={t(6)} className="size-28 shrink-0" />
      </div>
    </div>
  );
}

export default function PaperSolution() {
  return (
    <section className="relative py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Reveal y={40}>
          <MarkedSheet />
        </Reveal>

        <div>
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-violet-300">The step solver</p>
          </Reveal>
          <WordReveal text="Handwritten work, marked like a teacher would." className="mt-4 font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl" />
          <Reveal delay={150}>
            <p className="mt-5 text-lg leading-8 text-zinc-400">SolVε reads your working the way a patient teacher does: line by line, with a red pen and a reason for every mark.</p>
          </Reveal>
          <ul className="mt-8 space-y-5">
            {POINTS.map((p, i) => (
              <Reveal key={p.title} delay={200 + i * 100}>
                <li className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-violet-500/10 text-violet-300">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-medium text-white">{p.title}</p>
                    <p className="text-[15px] leading-7 text-zinc-400">{p.body}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ul>
          <Reveal delay={550}>
            <Link href="/login" className="btn-sheen mt-9 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#fffdf8]/75 px-6 py-3 font-medium text-white transition-all hover:border-violet-400/50 hover:bg-violet-500/10">
              Try the step solver <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
