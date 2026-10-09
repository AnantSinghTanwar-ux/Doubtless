"use client";

import { useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { AlertCircle, BookOpen, Check, ImageOff, Lightbulb, RotateCw, Sigma, Target, X } from "lucide-react";
import type { PageAnalysis } from "@/types/cowork";

export type AnalysisState =
  | { status: "loading" }
  | { status: "done"; data: PageAnalysis }
  | { status: "error"; error: string };

interface StudyPageProps {
  pageNumber: number;
  totalPages: number;
  state: AnalysisState | undefined;
  isActive: boolean;
  minHeight: number;
  onRetry: () => void;
  onJumpToPdf: () => void;
}

const markdown: Components = {
  p: ({ children }) => <p className="text-[15px] leading-7 text-ink/80 [&:not(:first-child)]:mt-3">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="text-ink">{children}</em>,
  ul: ({ children }) => <ul className="mt-3 space-y-1.5 list-disc pl-5 marker:text-pen/70 text-ink/80">{children}</ul>,
  ol: ({ children }) => <ol className="mt-3 space-y-1.5 list-decimal pl-5 marker:text-pen/70 text-ink/80">{children}</ol>,
  li: ({ children }) => <li className="text-[15px] leading-7 pl-1">{children}</li>,
  code: ({ children }) => <code className="px-1.5 py-0.5 rounded bg-ink/10 text-pen-deep text-[13px] font-mono">{children}</code>,
};

export function Md({ children }: { children: string }) {
  return <ReactMarkdown components={markdown}>{children}</ReactMarkdown>;
}

function Section({ icon, title, accent, children }: { icon: ReactNode; title: string; accent: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h4 className={`flex items-center gap-2 text-xs font-semibold ${accent}`}>
        {icon}
        {title}
      </h4>
      {children}
    </section>
  );
}

function PracticeQuestion({ q, n }: { q: PageAnalysis["practice"][number]; n: number }) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;

  return (
    <div className="rounded-xl border border-line bg-sheet p-4">
      <p className="text-[15px] leading-6 text-slate-100 font-medium">
        <span className="text-pen mr-2">Q{n}.</span>
        {q.question}
      </p>
      <div className="mt-3 grid gap-2">
        {q.options.map((opt, i) => {
          const isCorrect = i === q.answer;
          const isPicked = i === picked;
          let cls = "border-line hover:border-pen/50 hover:bg-pen/5 text-ink/80";
          if (answered && isCorrect) cls = "border-emerald-500/60 bg-emerald-500/10 text-emerald-100";
          else if (answered && isPicked) cls = "border-rose-500/60 bg-rose-500/10 text-rose-100";
          else if (answered) cls = "border-[#e2d9c6] text-faint";
          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => setPicked(i)}
              className={`flex items-center gap-3 text-left rounded-lg border px-3 py-2.5 text-sm transition-colors ${cls}`}
            >
              <span className="shrink-0 w-6 h-6 rounded-md border border-current/30 flex items-center justify-center text-xs font-semibold opacity-80">
                {answered && isCorrect ? <Check className="w-3.5 h-3.5" /> : answered && isPicked ? <X className="w-3.5 h-3.5" /> : String.fromCharCode(65 + i)}
              </span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
      {answered && q.explanation && (
        <p className="mt-3 text-sm leading-6 text-muted border-l-2 border-pen/40 pl-3">{q.explanation}</p>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Analyzing page">
      <div className="h-7 w-2/3 rounded-lg bg-ink/[0.06]" />
      <div className="space-y-2.5">
        <div className="h-3.5 rounded bg-ink/[0.05]" />
        <div className="h-3.5 rounded bg-ink/[0.05]" />
        <div className="h-3.5 w-4/5 rounded bg-ink/[0.05]" />
      </div>
      <div className="space-y-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 rounded-lg bg-sheet" />
        ))}
      </div>
      <p className="text-xs text-faint">Reading this page and building your notes…</p>
    </div>
  );
}

export function FormulaCard({ name, formula, note, page, onPage }: { name: string; formula: string; note?: string; page?: number; onPage?: () => void }) {
  return (
    <div className="rounded-xl border border-pen/15 bg-pen/[0.04] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-pen-deep/80">{name}</p>
        {page && onPage && (
          <button onClick={onPage} className="shrink-0 text-[10px] font-medium text-faint hover:text-pen">
            p.{page}
          </button>
        )}
      </div>
      <p className="mt-1.5 font-mono text-[15px] leading-6 text-ink break-words">{formula}</p>
      {note && <p className="mt-1.5 text-xs leading-5 text-muted">{note}</p>}
    </div>
  );
}

export default function StudyPage({ pageNumber, totalPages, state, isActive, minHeight, onRetry, onJumpToPdf }: StudyPageProps) {
  const data = state?.status === "done" ? state.data : null;
  const isBlank = data && !data.hasContent;

  return (
    <article
      className={`relative rounded-card border bg-sheet transition-colors duration-300 ${
        isActive ? "border-pen/30" : "border-line"
      }`}
      style={{ minHeight: isBlank ? 200 : minHeight }}
    >
      <div
        className={`absolute left-0 top-6 bottom-6 w-[3px] rounded-full transition-opacity duration-300 bg-pen ${
          isActive ? "opacity-100" : "opacity-0"
        }`}
      />

      <header className="flex items-center justify-between gap-3 px-6 sm:px-8 pt-6">
        <button
          onClick={onJumpToPdf}
          className="text-xs font-semibold text-faint hover:text-pen transition-colors"
          title="Show this page in the PDF"
        >
          Page {pageNumber} <span className="text-faint">/ {totalPages}</span>
        </button>
        {data && data.highlights.length > 0 && (
          <button
            onClick={onJumpToPdf}
            className="flex items-center gap-1.5 rounded-full bg-rose-500/10 border border-rose-400/20 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/15 transition-colors"
            title="See the highlights on the PDF"
          >
            <span className="w-3.5 h-3.5 rounded-full bg-rose-500 text-snow text-[10px] font-black leading-[14px] text-center">!</span>
            {data.highlights.length} marked on PDF
          </button>
        )}
      </header>

      <div className="px-6 sm:px-8 pb-8 pt-4">
        {(!state || state.status === "loading") && <Skeleton />}

        {isBlank && (
          <div className="flex items-center gap-3 py-6 text-faint">
            <ImageOff className="w-5 h-5 shrink-0" />
            <p className="text-sm">{data.title ? `${data.title} — ` : ""}nothing to study on this page.</p>
          </div>
        )}

        {state?.status === "error" && (
          <div className="flex flex-col items-center justify-center text-center py-16 gap-4">
            <AlertCircle className="w-8 h-8 text-rose-400" />
            <div>
              <p className="text-ink font-medium">Couldn&apos;t analyze this page</p>
              <p className="text-sm text-faint mt-1 max-w-sm line-clamp-3">{state.error}</p>
            </div>
            <button
              onClick={onRetry}
              className="flex items-center gap-2 rounded-lg bg-ink/[0.06] hover:bg-ink/10 border border-line px-4 py-2 text-sm text-ink transition-colors"
            >
              <RotateCw className="w-4 h-4" /> Try again
            </button>
          </div>
        )}

        {data && !isBlank && (
          <div className="space-y-8">
            {data.title && <h3 className="text-2xl font-semibold tracking-tight text-ink leading-snug">{data.title}</h3>}

            {data.summary && (
              <Section icon={<BookOpen className="w-3.5 h-3.5" />} title="Summary" accent="text-pen">
                <Md>{data.summary}</Md>
              </Section>
            )}

            {data.keyPoints.length > 0 && (
              <Section icon={<Lightbulb className="w-3.5 h-3.5" />} title="Key points" accent="text-amber-300">
                <ul className="space-y-2">
                  {data.keyPoints.map((k, i) => (
                    <li key={i} className="flex gap-3 rounded-lg bg-amber-400/[0.04] border border-amber-400/10 px-3.5 py-2.5">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-amber-300/80 shrink-0" />
                      <span className="text-[15px] leading-6 text-ink">{k}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {data.formulas.length > 0 && (
              <Section icon={<Sigma className="w-3.5 h-3.5" />} title="Formulas & notation" accent="text-pen">
                <div className="grid gap-2 sm:grid-cols-2">
                  {data.formulas.map((f, i) => (
                    <FormulaCard key={i} {...f} />
                  ))}
                </div>
              </Section>
            )}

            {data.examTip && (
              <div className="flex gap-3 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] px-4 py-3">
                <Target className="w-4 h-4 mt-0.5 shrink-0 text-rose-300" />
                <p className="text-sm leading-6 text-rose-100/90">
                  <span className="font-semibold text-rose-200">Exam tip: </span>
                  {data.examTip}
                </p>
              </div>
            )}

            {data.practice.length > 0 && (
              <Section icon={<Check className="w-3.5 h-3.5" />} title="Quick check" accent="text-emerald-300">
                <div className="space-y-3">
                  {data.practice.map((q, i) => (
                    <PracticeQuestion key={i} q={q} n={i + 1} />
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
