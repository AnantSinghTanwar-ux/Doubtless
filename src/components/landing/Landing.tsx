"use client";

import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import LandingNav from "./LandingNav";
import HeroPreview from "./HeroPreview";
import { Features, FinalCta, Footer, HowItWorks, Teachers } from "./Sections";
import { WordReveal } from "./Reveal";

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <LandingNav />

      {/* faint page rails, like the portfolio */}
      <div className="pointer-events-none fixed inset-y-0 left-[calc(50%-620px)] hidden border-l border-dashed border-white/[0.07] xl:block" />
      <div className="pointer-events-none fixed inset-y-0 right-[calc(50%-620px)] hidden border-r border-dashed border-white/[0.07] xl:block" />

      <main>
        <section id="top" className="relative px-6 pb-16 pt-40 text-center sm:pt-48">
          <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[44rem]" />
          <div className="lp-glow pointer-events-none absolute left-1/2 top-24 h-80 w-[44rem] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]" />

          <div className="relative mx-auto max-w-4xl">
            <div className="lp-rise mx-auto mb-8 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-300 backdrop-blur" style={{ animationDelay: "0.1s" }}>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-70" />
                <span className="relative h-2 w-2 rounded-full bg-violet-400" />
              </span>
              AI-native education, built around real doubts
            </div>

            <WordReveal text="Doubt less." level={1} className="font-display text-6xl font-bold leading-[1.02] tracking-tight text-white sm:text-7xl md:text-8xl" />
            <WordReveal text="Learn more." level={1} delay={260} className="font-display text-6xl font-bold leading-[1.02] tracking-tight sm:text-7xl md:text-8xl" wordClassName="gradient-text" />

            <p className="lp-rise mx-auto mt-8 max-w-2xl text-lg leading-8 text-zinc-400 sm:text-xl" style={{ animationDelay: "0.7s" }}>
              Doubtless reads your doubt, works out <span className="text-white">why you&apos;re stuck</span>, and sends you to the fastest help: an instant AI explanation, targeted practice, or a{" "}
              <span className="text-violet-300">live session with a verified teacher</span>.
            </p>

            <div className="lp-rise mt-10 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "0.9s" }}>
              <Link href="/login" className="btn-sheen group flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 px-7 py-3.5 text-base font-semibold text-white shadow-[0_12px_40px_-10px_rgba(139,92,246,0.9)] transition-transform hover:scale-[1.04]">
                Start learning <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/login" className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-7 py-3.5 text-base font-medium text-white backdrop-blur transition-colors hover:border-violet-400/40 hover:bg-violet-500/10">
                <GraduationCap className="h-5 w-5 text-violet-300" /> Teach on Doubtless
              </Link>
            </div>

            <div className="lp-rise mx-auto mt-14 grid max-w-xl grid-cols-3 gap-6 border-t border-white/10 pt-8 text-left" style={{ animationDelay: "1.1s" }}>
              {[
                ["10", "Learning tools"],
                ["1:1", "Live video help"],
                ["AI + Human", "Two ways to get help"],
              ].map(([n, l]) => (
                <div key={l}>
                  <p className="font-display text-2xl font-bold text-white sm:text-3xl">{n}</p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">{l}</p>
                </div>
              ))}
            </div>
          </div>

          <HeroPreview />
        </section>

        <Features />
        <HowItWorks />
        <Teachers />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
