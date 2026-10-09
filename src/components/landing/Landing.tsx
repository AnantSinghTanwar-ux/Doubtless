"use client";

import Link from "next/link";
import { GraduationCap } from "lucide-react";
import LandingNav from "./LandingNav";
import { Features, FinalCta, Footer, HowItWorks, Router, Teachers } from "./Sections";
import { WordReveal } from "./Reveal";
import { MarkedSheet } from "./PaperSolution";

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <LandingNav />

      <main id="main">
        <section id="top" className="pb-20 pt-28 sm:pt-36 lg:pb-28 lg:pt-40">
          <div className="mx-auto grid max-w-6xl px-6 items-center gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
            <div>
              <h1 className="display text-[3.4rem] text-ink sm:text-7xl lg:text-[5.25rem]">
                <WordReveal text="Doubt less." level={0} />
                <WordReveal text="Learn more." level={0} delay={240} />
              </h1>

              <p className="lp-rise mt-7 max-w-lg text-lg leading-8 text-muted sm:text-xl sm:leading-9" style={{ animationDelay: "0.6s" }}>
                ωlvε works out why you&apos;re stuck, then sends you to the fastest help: an instant AI explanation, targeted practice, or a live session with a verified teacher.
              </p>

              <div className="lp-rise mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: "0.8s" }}>
                <Link href="/login" className="rounded-[10px] bg-ink px-6 py-3.5 text-base font-medium text-snow shadow-sheet transition-colors hover:bg-[#1f3159]">
                  Start learning
                </Link>
                <Link href="/login" className="flex items-center gap-2 rounded-[10px] border border-line-strong bg-sheet px-6 py-3.5 text-base font-medium text-ink transition-colors hover:border-ink/40">
                  <GraduationCap className="h-5 w-5 text-pen" aria-hidden /> Teach on ωlvε
                </Link>
              </div>
              <p className="lp-rise mt-5 text-sm text-faint" style={{ animationDelay: "0.95s" }}>
                Sign in with Google. Ask your first doubt in under a minute.
              </p>
            </div>

            <div className="lp-rise" style={{ animationDelay: "0.35s" }}>
              <MarkedSheet />
            </div>
          </div>
        </section>

        <Router />
        <Features />
        <HowItWorks />
        <Teachers />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
