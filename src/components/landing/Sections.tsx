"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
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
import { Reveal, WordReveal, useInView } from "./Reveal";
import HeroPreview from "./HeroPreview";
import Logo from "./Logo";
import { cn } from "@/lib/utils";

const h2 = "display text-4xl text-ink sm:text-5xl";
const lede = "mt-5 max-w-2xl text-lg leading-8 text-muted";

export function Router() {
  return (
    <section className="border-y border-line bg-sunk/60 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-10 max-w-2xl">
          <WordReveal text="A doubt goes in. The right help comes out." className={h2} />
          <Reveal delay={120}>
            <p className={lede}>Ask in your own words. ωlvε reads it against your history and your notes, names the kind of gap, and picks the route that will fix it fastest.</p>
          </Reveal>
        </div>
        <Reveal>
          <HeroPreview />
        </Reveal>
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: Route, title: "Knows why you're stuck", body: "Diagnoses a concept gap, a missing prerequisite or a careless slip, then picks the fastest fix: AI explanation, targeted practice or a live teacher." },
  { icon: Library, title: "Answers from your own notes", body: "Upload your PDFs and textbooks. Explanations are grounded in your material and point to the exact page." },
  { icon: PenTool, title: "Every step, checked", body: "Type your working or snap a photo. ωlvε finds the first wrong step, explains the slip and scores your method." },
  { icon: Mic, title: "Teach it out loud", body: "Explain a topic in your own words. Get scored on accuracy, structure, clarity, filler words and pauses." },
  { icon: Target, title: "A spoken exam that adapts", body: "Face an oral exam that gets harder as you answer well, then get a report with weak topics and a study plan." },
  { icon: Dumbbell, title: "Practice that targets gaps", body: "Question sets built around the subtopics you keep missing, with hints and instant feedback." },
  { icon: FileText, title: "Mock papers from your syllabus", body: "Generate full practice papers from the material you uploaded, so you rehearse what you'll actually be tested on." },
  { icon: Briefcase, title: "A reading partner for PDFs", body: "Read alongside an AI that highlights, annotates and summarizes the page you're on." },
  { icon: Video, title: "Face to face with a teacher", body: "One-to-one video and chat with a verified teacher. No downloads, no waiting room, and the teacher already sees your diagnosis." },
  { icon: Brain, title: "It remembers what works", body: "A mastery heatmap, score trends and the explanations that clicked for you, so every answer gets more personal." },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <WordReveal text="Ten tools. One place to get unstuck." className={cn(h2, "max-w-3xl")} />
        <Reveal delay={120}>
          <p className={lede}>Ask a doubt any way you like. ωlvε works out what kind of help you need, from instant AI answers to a real teacher on video.</p>
        </Reveal>

        <ul className="mt-14 grid gap-x-14 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex items-start gap-4 border-t border-line-strong py-7">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pen/10 text-pen">
                <f.icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-display text-xl font-semibold text-ink">{f.title}</h3>
                <p className="mt-1.5 text-[15px] leading-7 text-muted">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const STEPS = [
  { n: "1", title: "Ask however you like", body: "Type it, speak it, or upload a photo of the problem. Add your own notes to the Study Vault for answers that cite your material." },
  { n: "2", title: "ωlvε finds the gap", body: "The router reads your doubt together with your history and learner profile, and decides whether you need an explanation, practice or a human." },
  { n: "3", title: "Get the right help, instantly", body: "An AI explanation with page citations, a practice set aimed at your weak spots, or a live video session with a verified teacher who already knows where you're stuck." },
  { n: "4", title: "It remembers, so you improve", body: "Session summaries and results feed your profile and a shared knowledge base. The next answer is a little sharper, and so are you." },
];

export function HowItWorks() {
  const ref = useRef<HTMLOListElement>(null);
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
    <section id="how" className="scroll-mt-20 border-y border-line bg-sunk/60 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <WordReveal text="From stuck to sorted in four steps." className={cn(h2, "max-w-3xl")} />

        <ol ref={ref} className="relative mt-14 space-y-12 pl-12 sm:pl-16">
          <div aria-hidden className="absolute bottom-2 left-[15px] top-2 w-px bg-line-strong sm:left-[19px]">
            <div className="w-full bg-pen" style={{ height: `${progress * 100}%`, transition: "height 120ms linear" }} />
          </div>
          {STEPS.map((s, i) => {
            const reached = progress >= (i + 0.35) / STEPS.length;
            return (
              <li key={s.n} className="relative">
                <span
                  aria-hidden
                  className={cn(
                    "absolute -left-12 top-0.5 flex h-8 w-8 items-center justify-center rounded-full border font-display text-sm font-semibold transition-colors duration-500 sm:-left-16 sm:h-10 sm:w-10",
                    reached ? "border-pen bg-pen text-snow" : "border-line-strong bg-sheet text-faint"
                  )}
                >
                  {s.n}
                </span>
                <h3 className={cn("font-display text-2xl font-semibold transition-colors duration-500", reached ? "text-ink" : "text-faint")}>{s.title}</h3>
                <p className="mt-2 max-w-2xl text-[17px] leading-8 text-muted">{s.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

const CHECKS = ["Government ID and qualification reviewed", "Live selfie with a random gesture challenge", "Recorded video introduction", "AI pre-screen, then a human reviewer decides"];

export function Teachers() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  return (
    <section id="teachers" className="scroll-mt-20 py-24 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-2">
        <div>
          <WordReveal text="Real teachers, verified for real." className={h2} />
          <Reveal delay={120}>
            <p className={lede}>
              Every teacher profile shows whether the person has been verified, so students always know who they&apos;re learning from. If you teach, register once, prove who you are with your camera, and start taking live sessions with students who arrive with their doubt already diagnosed.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <Link href="/login" className="mt-8 inline-flex items-center gap-2 rounded-[10px] border border-line-strong bg-sheet px-6 py-3 font-medium text-ink transition-colors hover:border-ink/40">
              <GraduationCap className="h-5 w-5 text-pen" aria-hidden /> Apply to teach
            </Link>
          </Reveal>
        </div>

        <Reveal delay={120}>
          <div ref={ref} className="rounded-card border border-line bg-sheet p-6 shadow-lift sm:p-7">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink text-snow">
                <ScanFace className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <p className="font-display text-lg font-semibold text-ink">Teacher verification</p>
                <p className="text-sm text-muted">Takes about five minutes</p>
              </div>
            </div>
            <ul className="space-y-3.5">
              {CHECKS.map((c, i) => (
                <li
                  key={c}
                  className="flex items-center gap-3 text-[15px] text-ink"
                  style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "translateX(-10px)", transition: "all 0.5s cubic-bezier(0.22,1,0.36,1)", transitionDelay: `${200 + i * 220}ms` }}
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-pen" aria-hidden /> {c}
                </li>
              ))}
            </ul>
            <div
              className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-pen/25 bg-pen-wash px-4 py-3.5"
              style={{ opacity: inView ? 1 : 0, transition: "opacity 0.6s ease", transitionDelay: "1.2s" }}
            >
              <span className="text-sm text-pen-deep">Approved teachers get a public badge. Others are clearly labelled unverified.</span>
              <span className="flex items-center gap-1.5 rounded-full bg-pen px-3 py-1 text-sm font-medium text-snow">
                <BadgeCheck className="h-4 w-4" aria-hidden /> Verified
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
    <section className="px-6 pb-24">
      <Reveal className="mx-auto max-w-5xl">
        <div className="rounded-3xl bg-ink px-8 py-16 text-center text-snow sm:px-16">
          <h2 className="display text-4xl sm:text-5xl">Ready to doubt less?</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-snow/75">Sign in with Google and ask your first doubt in under a minute.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/login" className="rounded-[10px] bg-snow px-7 py-3.5 font-medium text-ink transition-colors hover:bg-paper">
              Start learning
            </Link>
            <Link href="/login" className="rounded-[10px] border border-snow/35 px-7 py-3.5 font-medium text-snow transition-colors hover:bg-snow/10">
              I&apos;m a teacher
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted sm:flex-row">
        <div className="flex items-center gap-3">
          <Logo size={30} />
          <span className="font-display text-lg font-semibold text-ink">ωlvε</span>
        </div>
        <p>The Industry Games 2026, District 03: AI-Native Education</p>
      </div>
    </footer>
  );
}
