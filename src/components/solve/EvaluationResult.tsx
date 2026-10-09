"use client";

import Card, { CardTitle } from "@/components/ui/Card";
import { FileText, Library } from "lucide-react";
import Callout from "@/components/ui/Callout";
import { getScoreColor } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import type { SolutionEvaluation } from "@/types";
import { Cross, ScoreCircle, Tick } from "@/components/paper/Pen";
import { useInView } from "@/components/landing/Reveal";

interface EvaluationResultProps {
  evaluation: SolutionEvaluation;
}

export default function EvaluationResult({ evaluation }: EvaluationResultProps) {
  
  return (
    <div className="space-y-6">
      
      {evaluation.first_error_step !== null ? (
        <Callout tone="error" title={`Mistake caught at step ${evaluation.first_error_step}`}>
          Review that step carefully. The steps after it may be affected by the error.
        </Callout>
      ) : (
        <Callout tone="success" title="Every step holds up">
          All steps are logically sound and correct. Great work.
        </Callout>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="mb-1 text-sm text-muted">Total Score</div>
          <div className={`display tabular text-3xl ${getScoreColor(evaluation.rubric.total)}`}>
            {evaluation.rubric.total}<span className="text-base font-normal text-faint">/10</span>
          </div>
        </Card>
        <Card className="p-4 text-center">
          <div className="mb-1 text-sm text-muted">Correctness</div>
          <div className={`display tabular text-2xl ${getScoreColor(evaluation.rubric.correctness)}`}>
            {evaluation.rubric.correctness}<span className="text-sm font-normal text-faint">/10</span>
          </div>
        </Card>
        <Card className="p-4 text-center">
          <div className="mb-1 text-sm text-muted">Method</div>
          <div className={`display tabular text-2xl ${getScoreColor(evaluation.rubric.method)}`}>
            {evaluation.rubric.method}<span className="text-sm font-normal text-faint">/10</span>
          </div>
        </Card>
        <Card className="p-4 text-center">
          <div className="mb-1 text-sm text-muted">Clarity</div>
          <div className={`display tabular text-2xl ${getScoreColor(evaluation.rubric.clarity_notation)}`}>
            {evaluation.rubric.clarity_notation}<span className="text-sm font-normal text-faint">/10</span>
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
          <Card>
            <CardTitle className="mb-3 flex items-center gap-2 text-base">
              <Library className="h-4 w-4 text-pen" aria-hidden /> Sources used
            </CardTitle>
            <ul className="space-y-2">
              {evaluation.source_citations.map((cite, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg border border-line bg-paper p-2.5 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-pen" aria-hidden />
                  <span className="font-medium text-ink">{cite.pdf_name}</span> 
                  <span className="text-faint">Page {cite.page}</span>
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
      <p className="serif paper-line text-sm font-semibold text-[#1b2440]/70">Marked step by step</p>

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
