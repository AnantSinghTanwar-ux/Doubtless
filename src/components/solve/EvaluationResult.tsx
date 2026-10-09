"use client";

import Card, { CardTitle } from "@/components/ui/Card";
import { getVerdictColor, getScoreColor } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import type { SolutionEvaluation } from "@/types";
import { Cross, ScoreCircle, Tick } from "@/components/paper/Pen";
import { useInView } from "@/components/landing/Reveal";

interface EvaluationResultProps {
  evaluation: SolutionEvaluation;
}

export default function EvaluationResult({ evaluation }: EvaluationResultProps) {
  
  const getVerdictLabel = (verdict: string) => {
    switch (verdict) {
      case "correct": return "Correct";
      case "error": return "Error";
      case "redundant": return "Redundant";
      case "unclear": return "Unclear";
      default: return verdict;
    }
  };

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case "correct": return "✅";
      case "error": return "❌";
      case "redundant": return "⚠️";
      case "unclear": return "❓";
      default: return "";
    }
  };

  return (
    <div className="space-y-6">
      
      {evaluation.first_error_step !== null && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <span className="text-red-400 text-xl">🚨</span>
          <div>
            <h4 className="text-red-400 font-medium text-sm">Mistake caught at Step {evaluation.first_error_step}</h4>
            <p className="text-red-400/80 text-xs mt-1">
              Review that step carefully. The subsequent steps might be affected by this error.
            </p>
          </div>
        </div>
      )}

      {evaluation.first_error_step === null && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
          <span className="text-emerald-400 text-xl">🎉</span>
          <div>
            <h4 className="text-emerald-400 font-medium text-sm">Perfect Solution!</h4>
            <p className="text-emerald-400/80 text-xs mt-1">
              All steps are logically sound and correct. Great job!
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#fffdf8]/80 text-center p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Score</div>
          <div className={`text-3xl font-bold ${getScoreColor(evaluation.rubric.total)}`}>
            {evaluation.rubric.total}<span className="text-base font-normal text-gray-500">/10</span>
          </div>
        </Card>
        <Card className="bg-[#fffdf8]/80 text-center p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Correctness</div>
          <div className={`text-2xl font-bold ${getScoreColor(evaluation.rubric.correctness)}`}>
            {evaluation.rubric.correctness}<span className="text-sm font-normal text-gray-500">/10</span>
          </div>
        </Card>
        <Card className="bg-[#fffdf8]/80 text-center p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Method</div>
          <div className={`text-2xl font-bold ${getScoreColor(evaluation.rubric.method)}`}>
            {evaluation.rubric.method}<span className="text-sm font-normal text-gray-500">/10</span>
          </div>
        </Card>
        <Card className="bg-[#fffdf8]/80 text-center p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Clarity</div>
          <div className={`text-2xl font-bold ${getScoreColor(evaluation.rubric.clarity_notation)}`}>
            {evaluation.rubric.clarity_notation}<span className="text-sm font-normal text-gray-500">/10</span>
          </div>
        </Card>
      </div>

      <MarkedSteps evaluation={evaluation} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="paper paper-plain slide-up px-6 pb-6 pt-6">
          <p className="hand ink-blue mb-2 text-3xl leading-none">Model solution</p>
          <div className="serif text-[15px] leading-7 text-[#1b2440] [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-2 [&_strong]:font-semibold">
            <ReactMarkdown>{evaluation.model_solution}</ReactMarkdown>
          </div>
        </div>

        {evaluation.source_citations.length > 0 && (
          <Card className="bg-[#fffdf8]/50 border-blue-500/20">
            <CardTitle className="text-sm mb-3 text-blue-400 flex items-center gap-2">
              <span>📚</span> Sources Used
            </CardTitle>
            <ul className="space-y-2">
              {evaluation.source_citations.map((cite, i) => (
                <li key={i} className="text-sm text-gray-300 flex items-center gap-2 p-2 rounded-lg bg-[#fffdf8]/55 border border-white/[0.06]">
                  <span className="text-blue-500 text-lg">📄</span> 
                  <span className="font-medium text-white">{cite.pdf_name}</span> 
                  <span className="text-gray-500">· Page {cite.page}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

    </div>
  );
}

/** The student's steps on ruled paper, marked in red pen with the teacher's notes written beside them. */
function MarkedSteps({ evaluation }: { evaluation: SolutionEvaluation }) {
  const { ref, inView: on } = useInView<HTMLDivElement>(0.1);
  const first = evaluation.first_error_step;

  return (
    <div ref={ref} className="paper slide-up pb-8 pl-[4.6rem] pr-14 pt-[2.1rem]">
      <p className="serif paper-line text-sm font-semibold uppercase tracking-wider text-[#1b2440]/70">Marked step by step</p>

      {evaluation.steps.map((step, idx) => (
        <div key={idx} className="relative mb-[2.1rem]">
          <span className="hand ink-red absolute -left-[3.7rem] top-0 w-[2.4rem] text-center text-[1.7rem] leading-[2.1rem]">{step.step}</span>
          <span className="absolute -right-11 top-0.5">
            {step.verdict === "correct" ? (
              <Tick on={on} delay={0.3 + idx * 0.25} />
            ) : step.verdict === "error" ? (
              <Cross on={on} delay={0.3 + idx * 0.25} />
            ) : (
              <span className="hand ink-red text-3xl leading-[2.1rem]">{step.verdict === "unclear" ? "?" : "~"}</span>
            )}
          </span>
          {step.explanation && (
            <div className="serif paper-line text-[15px] text-[#1b2440] [&_p]:leading-[2.1rem] [&_strong]:font-semibold">
              <ReactMarkdown>{step.explanation}</ReactMarkdown>
            </div>
          )}
          {step.error_type && <p className="hand ink-red paper-line text-[1.4rem]">⟵ {step.error_type}</p>}
          {step.fix && (
            <div className="hand ink-red text-[1.45rem] [&_p]:leading-[2.1rem]">
              <ReactMarkdown>{step.fix}</ReactMarkdown>
            </div>
          )}
        </div>
      ))}

      <div className="flex items-end justify-between gap-4">
        <p className="hand ink-red text-2xl leading-tight">
          {first === null ? "Every step holds up. Well done!" : `First slip at step ${first}.`}
        </p>
        <ScoreCircle value={evaluation.rubric.total} max={10} on={on} delay={0.4 + evaluation.steps.length * 0.25} className="size-28 shrink-0" />
      </div>
    </div>
  );
}
