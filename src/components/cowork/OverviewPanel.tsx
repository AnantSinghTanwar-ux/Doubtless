"use client";

import { useState, type ReactNode } from "react";
import { AlertCircle, ChevronDown, FileStack, GraduationCap, Layers, ListChecks, RotateCw, Sigma, Sparkles } from "lucide-react";
import type { DocumentOverview } from "@/types/cowork";
import { FormulaCard, Md } from "./StudyPage";

export type OverviewState =
  | { status: "idle" }
  | { status: "preparing"; done: number; total: number }
  | { status: "generating" }
  | { status: "done"; data: DocumentOverview }
  | { status: "error"; error: string };

interface OverviewPanelProps {
  state: OverviewState;
  numPages: number;
  onGoToPage: (page: number) => void;
  onRegenerate: () => void;
}

function Block({ id, icon, title, count, accent, children, action }: { id: string; icon: ReactNode; title: string; count?: number; accent: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section id={id} className="rounded-2xl border border-white/[0.06] bg-[#fbf8f0] p-5 sm:p-6 scroll-mt-20">
      <header className="flex items-center justify-between gap-3 mb-4">
        <h3 className="flex items-center gap-2.5 text-base font-semibold text-white">
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>{icon}</span>
          {title}
          {count !== undefined && <span className="text-xs font-medium text-slate-500">{count}</span>}
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}

function PageLinks({ pages, onGoToPage }: { pages: number[]; onGoToPage: (p: number) => void }) {
  if (!pages.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {pages.slice(0, 4).map((p) => (
        // A span, not a <button>: these chips sit inside clickable rows, and nested buttons are invalid HTML.
        <span
          key={p}
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onGoToPage(p);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onGoToPage(p);
            }
          }}
          className="cursor-pointer rounded-md bg-white/[0.05] hover:bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-400 hover:text-blue-200 transition-colors"
        >
          p.{p}
        </span>
      ))}
    </span>
  );
}

function Question({ q, onGoToPage }: { q: DocumentOverview["importantQuestions"][number]; onGoToPage: (p: number) => void }) {
  const [open, setOpen] = useState(false);
  const high = q.priority === "high";
  return (
    <div className={`rounded-xl border overflow-hidden ${high ? "border-rose-400/20 bg-rose-500/[0.04]" : "border-white/[0.07] bg-[#fffdf8]/55"}`}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-start gap-3 p-4 text-left">
        {high ? (
          <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-rose-600 text-snow text-xs font-black leading-5 text-center shadow-[0_0_12px_rgba(225,29,72,0.5)]">!</span>
        ) : (
          <span className="mt-2 w-1.5 h-1.5 mx-[7px] shrink-0 rounded-full bg-slate-500" />
        )}
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] leading-6 text-slate-100">{q.question}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            {q.topic && <span>{q.topic}</span>}
            <PageLinks pages={q.pages} onGoToPage={onGoToPage} />
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 mt-1 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 pl-12">
          <div className="border-l-2 border-blue-400/30 pl-3">
            <Md>{q.answer}</Md>
          </div>
        </div>
      )}
    </div>
  );
}

function PyqGroup({ group, defaultOpen }: { group: DocumentOverview["pyqs"][number]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-white/[0.07] overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-[#fffdf8]/55 hover:bg-[#fffdf8]/75 text-left">
        <span className="text-sm font-medium text-slate-100">{group.topic}</span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          {group.questions.length}
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <ol className="divide-y divide-white/[0.05]">
          {group.questions.map((q, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-3">
              <span className="text-xs tabular-nums text-slate-600 mt-0.5 w-4 shrink-0">{i + 1}.</span>
              <span className="flex-1 text-sm leading-6 text-slate-200">{q.question}</span>
              <span className="flex flex-col items-end gap-1 shrink-0">
                {q.marks ? <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">{q.marks}M</span> : null}
                {q.source === "past_paper" && (
                  <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">Past paper</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function OverviewPanel({ state, numPages, onGoToPage, onRegenerate }: OverviewPanelProps) {
  if (state.status === "idle" || state.status === "preparing" || state.status === "generating") {
    const pct = state.status === "preparing" ? Math.round((state.done / Math.max(1, state.total)) * 60) : state.status === "generating" ? 75 : 0;
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-[#fbf8f0] px-6 py-16 text-center">
        <div className="relative w-14 h-14 mx-auto mb-5">
          <div className="absolute inset-0 rounded-2xl bg-blue-500/20 animate-ping" />
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
        </div>
        <p className="text-white font-medium">
          {state.status === "generating" ? "Building your study guide…" : `Reading all ${numPages || ""} pages…`}
        </p>
        <p className="text-sm text-slate-500 mt-1">
          {state.status === "preparing"
            ? `Preparing page ${state.done} of ${state.total}`
            : state.status === "generating"
              ? "Summary, formula sheet, important questions and PYQs. This takes about a minute."
              : "Starting…"}
        </p>
        <div className="mt-6 mx-auto max-w-xs h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-[width] duration-500 ${state.status === "generating" ? "animate-pulse" : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-[#fbf8f0] px-6 py-16 text-center">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
        <p className="text-slate-200 font-medium">Couldn&apos;t build the study guide</p>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{state.error}</p>
        <button
          onClick={onRegenerate}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white/[0.06] hover:bg-white/10 border border-white/10 px-4 py-2 text-sm text-slate-200"
        >
          <RotateCw className="w-4 h-4" /> Try again
        </button>
      </div>
    );
  }

  const d = state.data;
  const highQs = d.importantQuestions.filter((q) => q.priority === "high").length;
  const pyqCount = d.pyqs.reduce((n, g) => n + g.questions.length, 0);
  const nav = [
    { id: "ov-topics", label: "Topics", n: d.topics.length },
    { id: "ov-formulas", label: "Formula sheet", n: d.formulas.length },
    { id: "ov-questions", label: "Important Qs", n: d.importantQuestions.length },
    { id: "ov-pyqs", label: "PYQs", n: pyqCount },
  ].filter((x) => x.n > 0);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-blue-400/15 bg-gradient-to-br from-[#f3eee2] via-[#f3eee2] to-[#f3eee2] p-6 sm:p-7">
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-blue-200">
              <FileStack className="w-3.5 h-3.5" /> Whole-document guide · {numPages} pages
            </span>
            <button onClick={onRegenerate} className="text-slate-500 hover:text-slate-300 p-1" title="Regenerate">
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
          {d.subject && <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">{d.subject}</h2>}
          <div className="mt-3">
            <Md>{d.overview}</Md>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {nav.map((x) => (
              <a
                key={x.id}
                href={`#${x.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(x.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.06] px-3 py-1.5 text-xs text-slate-200 transition-colors"
              >
                {x.label} <span className="text-slate-500 ml-1">{x.n}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {d.topics.length > 0 && (
        <Block id="ov-topics" icon={<Layers className="w-4 h-4 text-blue-300" />} accent="bg-blue-500/15" title="Topics covered" count={d.topics.length}>
          <ol className="relative space-y-1">
            {d.topics.map((t, i) => (
              <li key={i}>
                <button
                  onClick={() => t.pages[0] && onGoToPage(t.pages[0])}
                  className="group w-full flex items-start gap-3 rounded-lg px-2 py-2.5 -mx-2 text-left hover:bg-[#fffdf8]/75 transition-colors"
                >
                  <span
                    className={`mt-1.5 w-2 h-2 shrink-0 rounded-full ${
                      t.importance === "high" ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]" : t.importance === "medium" ? "bg-amber-400" : "bg-slate-600"
                    }`}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-100 group-hover:text-white">{t.name}</span>
                      {t.importance === "high" && (
                        <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300">Must know</span>
                      )}
                    </span>
                    {t.summary && <span className="block text-[13px] leading-5 text-slate-400 mt-0.5">{t.summary}</span>}
                  </span>
                  <PageLinks pages={t.pages} onGoToPage={onGoToPage} />
                </button>
              </li>
            ))}
          </ol>
        </Block>
      )}

      {d.formulas.length > 0 && (
        <Block id="ov-formulas" icon={<Sigma className="w-4 h-4 text-violet-300" />} accent="bg-violet-500/15" title="Formula sheet" count={d.formulas.length}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {d.formulas.map((f, i) => (
              <FormulaCard key={i} {...f} onPage={f.page ? () => onGoToPage(f.page!) : undefined} />
            ))}
          </div>
        </Block>
      )}

      {d.importantQuestions.length > 0 && (
        <Block
          id="ov-questions"
          icon={<ListChecks className="w-4 h-4 text-rose-300" />}
          accent="bg-rose-500/15"
          title="Important questions"
          count={d.importantQuestions.length}
          action={highQs > 0 ? <span className="text-[11px] text-rose-300/80">{highQs} high priority</span> : undefined}
        >
          <div className="space-y-2">
            {[...d.importantQuestions]
              .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "high" ? -1 : 1))
              .map((q, i) => (
                <Question key={i} q={q} onGoToPage={onGoToPage} />
              ))}
          </div>
        </Block>
      )}

      {d.pyqs.length > 0 && (
        <Block id="ov-pyqs" icon={<GraduationCap className="w-4 h-4 text-emerald-300" />} accent="bg-emerald-500/15" title="Previous year questions by topic" count={pyqCount}>
          {!d.hasPastPapers && (
            <p className="mb-4 rounded-lg bg-[#fffdf8]/75 border border-white/[0.06] px-3 py-2 text-xs leading-5 text-slate-400">
              These are frequently asked university questions on this unit&apos;s topics. Upload past papers to this folder in your Study Vault to get questions taken from your own papers.
            </p>
          )}
          <div className="space-y-2">
            {d.pyqs.map((g, i) => (
              <PyqGroup key={i} group={g} defaultOpen={i < 2} />
            ))}
          </div>
        </Block>
      )}
    </div>
  );
}
