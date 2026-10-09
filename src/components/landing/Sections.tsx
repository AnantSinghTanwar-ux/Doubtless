"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  Briefcase,
  CheckCircle2,
  Dumbbell,
  FileText,
  GraduationCap,
  Library,
  Mic,
  PenTool,
  Route,
  ScanFace,
  Target,
  Video,
} from "lucide-react";
import { Reveal, SpotlightCard, WordReveal, useInView } from "./Reveal";
import Logo from "./Logo";
import { cn } from "@/lib/utils";

const eyebrow = "font-mono text-xs uppercase tracking-[0.22em] text-violet-300";

const FEATURES = [
  { icon: Route, tag: "Doubt router", title: "Knows why you're stuck", body: "Diagnoses a concept gap, a missing prerequisite or a careless slip, then picks the fastest fix: AI explanation, targeted practice or a live teacher." },
  { icon: Library, tag: "Study vault", title: "Answers from your own notes", body: "Upload your PDFs and textbooks. Explanations are grounded in your material and point to the exact page." },
  { icon: PenTool, tag: "Step solver", title: "Every step, checked", body: "Type your working or snap a photo. Doubtless finds the first wrong step, explains the slip and scores your method." },
  { icon: Mic, tag: "Voice explain", title: "Teach it out loud", body: "Explain a topic in your own words. Get scored on accuracy, structure, clarity, filler words and pauses." },
  { icon: Target, tag: "AI viva", title: "A spoken exam that adapts", body: "Face an oral exam that gets harder as you answer well, then get a report with weak topics and a study plan." },
  { icon: Dumbbell, tag: "Adaptive practice", title: "Practice that targets gaps", body: "Question sets built around the subtopics you keep missing, with hints and instant feedback." },
  { icon: FileText, tag: "Sample papers", title: "Mock papers from your syllabus", body: "Generate full practice papers from the material you uploaded, so you rehearse what you'll actually be tested on." },
  { icon: Briefcase, tag: "CoWork", title: "A reading partner for PDFs", body: "Read alongside an AI that highlights, annotates and summarizes the page you're on." },
  { icon: Video, tag: "Live sessions", title: "Face to face with a teacher", body: "One-to-one video and chat with a verified teacher. No downloads, no waiting room, and the teacher already sees your diagnosis." },
  { icon: Brain, tag: "Learner profile", title: "It remembers what works", body: "A mastery heatmap, score trends and the explanations that clicked for you, so every answer gets more personal." },
];

export function Features() {
  return (
    <section id="features" className="relative scroll-mt-24 py-28">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className={eyebrow}>What you get</p>
        </Reveal>
        <WordReveal text="Ten tools. One place to get unstuck." className="mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl" />
        <Reveal delay={150}>
          <p className="mt-5 max-w-2xl text-lg text-zinc-400">
            Doubtless is an AI-native education platform. Ask a doubt any way you like, and it works out what kind of help you need, from instant AI answers to a real teacher on video.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.tag} delay={(i % 3) * 90}>
              <SpotlightCard className="h-full p-6">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-violet-500/10 text-violet-300 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                  <f.icon className="h-5 w-5" />
                </div>
                <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">{f.tag}</p>
                <h3 className="mb-2 font-display text-xl font-semibold text-white">{f.title}</h3>
                <p className="text-[15px] leading-7 text-zinc-400">{f.body}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { n: "01", title: "Ask however you like", body: "Type it, speak it, or upload a photo of the problem. Add your own notes to the Study Vault for answers that cite your material." },
  { n: "02", title: "Doubtless finds the gap", body: "The router reads your doubt together with your history and learner profile, and decides whether you need an explanation, practice or a human." },
  { n: "03", title: "Get the right help, instantly", body: "An AI explanation with page citations, a practice set aimed at your weak spots, or a live video session with a verified teacher who already knows where you're stuck." },
  { n: "04", title: "It remembers, so you improve", body: "Session summaries and results feed your profile and a shared knowledge base. The next answer is a little sharper, and so are you." },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setProgress(Math.min(1, Math.max(0, (window.innerHeight * 0.6 - r.top) / r.height)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section id="how" className="relative scroll-mt-24 py-28">
      <div className="mx-auto max-w-5xl px-6">
        <Reveal>
          <p className={eyebrow}>How it works</p>
        </Reveal>
        <WordReveal text="From stuck to sorted in four steps." className="mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl" />

        <div ref={ref} className="relative mt-16 pl-10 sm:pl-16">
          <div className="absolute bottom-2 left-[15px] top-2 w-px bg-white/10 sm:left-[23px]">
            <div className="w-full bg-gradient-to-b from-violet-300 via-violet-500 to-purple-700 shadow-[0_0_14px_rgba(194, 65, 12,0.9)]" style={{ height: `${progress * 100}%`, transition: "height 120ms linear" }} />
          </div>
          <div className="space-y-14">
            {STEPS.map((s, i) => {
              const reached = progress >= (i + 0.35) / STEPS.length;
              return (
                <Reveal key={s.n}>
                  <div className="relative">
                    <span
                      className={cn(
                        "absolute -left-10 top-1 flex h-8 w-8 items-center justify-center rounded-full border font-mono text-[11px] transition-all duration-500 sm:-left-16 sm:h-12 sm:w-12 sm:text-sm",
                        reached ? "border-violet-400 bg-violet-500 text-snow shadow-[0_0_28px_rgba(194, 65, 12,0.7)]" : "border-white/15 bg-[#fffdf8] text-zinc-500"
                      )}
                    >
                      {s.n}
                    </span>
                    <h3 className={cn("font-display text-2xl font-semibold transition-colors duration-500", reached ? "text-white" : "text-zinc-500")}>{s.title}</h3>
                    <p className="mt-2 max-w-2xl text-[17px] leading-8 text-zinc-400">{s.body}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

const CHECKS = ["Government ID and qualification reviewed", "Live selfie with a random gesture challenge", "Recorded video introduction", "AI pre-screen, then a human reviewer decides"];

export function Teachers() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  return (
    <section id="teachers" className="relative scroll-mt-24 py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-2">
        <div>
          <Reveal>
            <p className={eyebrow}>For teachers</p>
          </Reveal>
          <WordReveal text="Real teachers, verified for real." className="mt-4 font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl" />
          <Reveal delay={150}>
            <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-400">
              Every teacher profile shows whether the person has been verified, so students always know who they&apos;re learning from. If you teach, you register once, prove who you are with your camera, and start taking live sessions with students who arrive with their doubt already diagnosed.
            </p>
          </Reveal>
          <Reveal delay={250}>
            <Link href="/login" className="btn-sheen mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#fffdf8]/75 px-6 py-3 font-medium text-white transition-all hover:border-violet-400/50 hover:bg-violet-500/10">
              <GraduationCap className="h-5 w-5 text-violet-300" /> Apply to teach <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>

        <Reveal delay={120}>
          <div ref={ref} className="relative rounded-3xl border border-white/10 bg-[#fffdf8]/85 p-7 shadow-[0_30px_100px_-40px_rgba(194, 65, 12,0.6)]">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 text-snow">
                <ScanFace className="h-7 w-7" />
              </div>
              <div>
                <p className="font-display text-lg font-semibold text-white">Teacher verification</p>
                <p className="text-sm text-zinc-500">Takes about five minutes</p>
              </div>
            </div>
            <ul className="space-y-3.5">
              {CHECKS.map((c, i) => (
                <li
                  key={c}
                  className="flex items-center gap-3 text-[15px] text-zinc-300"
                  style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "translateX(-14px)", transition: "all 0.6s cubic-bezier(0.22,1,0.36,1)", transitionDelay: `${300 + i * 350}ms` }}
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-violet-400" /> {c}
                </li>
              ))}
            </ul>
            <div
              className="mt-7 flex items-center justify-between rounded-2xl border border-violet-400/25 bg-violet-500/10 px-4 py-3.5"
              style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "scale(0.95)", transition: "all 0.6s cubic-bezier(0.22,1,0.36,1)", transitionDelay: "1.8s" }}
            >
              <span className="text-sm text-violet-100">Approved teachers get a public badge. Others are clearly labelled unverified.</span>
              <span className="flex items-center gap-1.5 rounded-full bg-violet-500 px-3 py-1 text-sm font-medium text-snow">
                <BadgeCheck className="h-4 w-4" /> Verified
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-5xl px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#fffdf8] px-8 py-16 text-center sm:px-16">
            <h2 className="relative font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Ready to <span className="text-orange-600">doubt less</span>?
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-lg text-zinc-400">Sign in with Google and ask your first doubt in under a minute.</p>
            <div className="relative mt-9 flex flex-wrap justify-center gap-3">
              <Link href="/login" className="btn-sheen inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-semibold text-zinc-950 transition-transform hover:scale-[1.04]">
                Start learning <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-7 py-3.5 font-medium text-white transition-colors hover:bg-white/5">
                I&apos;m a teacher
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/[0.07] py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-zinc-500 sm:flex-row">
        <div className="flex items-center gap-3">
          <Logo size={32} />
          <span className="font-display text-lg font-semibold text-zinc-200">Doubtless</span>
        </div>
        <p className="font-mono text-xs tracking-wide">The Industry Games 2026 · District 03: AI-Native Education</p>
      </div>
    </footer>
  );
}
