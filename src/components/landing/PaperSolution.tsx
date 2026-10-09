"use client";

import { useInView } from "./Reveal";
import { Circled, Cross, ScoreCircle, Tick, WriteOn } from "@/components/paper/Pen";

const STEP = 1.7; // seconds per written line

/** A student's handwritten answer being marked in red pen, the way a teacher would. */
export function MarkedSheet() {
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
