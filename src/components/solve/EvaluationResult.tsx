"use client";

import Card, { CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { getVerdictColor, getScoreColor } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import type { SolutionEvaluation } from "@/types";

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
        <Card className="bg-[#0f1628]/80 text-center p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Score</div>
          <div className={`text-3xl font-bold ${getScoreColor(evaluation.rubric.total)}`}>
            {evaluation.rubric.total}<span className="text-base font-normal text-gray-500">/10</span>
          </div>
        </Card>
        <Card className="bg-[#0f1628]/80 text-center p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Correctness</div>
          <div className={`text-2xl font-bold ${getScoreColor(evaluation.rubric.correctness)}`}>
            {evaluation.rubric.correctness}<span className="text-sm font-normal text-gray-500">/10</span>
          </div>
        </Card>
        <Card className="bg-[#0f1628]/80 text-center p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Method</div>
          <div className={`text-2xl font-bold ${getScoreColor(evaluation.rubric.method)}`}>
            {evaluation.rubric.method}<span className="text-sm font-normal text-gray-500">/10</span>
          </div>
        </Card>
        <Card className="bg-[#0f1628]/80 text-center p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Clarity</div>
          <div className={`text-2xl font-bold ${getScoreColor(evaluation.rubric.clarity_notation)}`}>
            {evaluation.rubric.clarity_notation}<span className="text-sm font-normal text-gray-500">/10</span>
          </div>
        </Card>
      </div>

      <Card className="bg-[#0f1628]/80 p-0 overflow-hidden border-white/[0.06]">
        <div className="p-4 border-b border-white/[0.06] bg-white/[0.02]">
          <h3 className="font-semibold text-white">Step-by-Step Analysis</h3>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {evaluation.steps.map((step, idx) => (
            <div key={idx} className="p-5 flex gap-4">
              <div className="flex-none">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm border ${getVerdictColor(step.verdict)}`}>
                  {step.step}
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className={`${getVerdictColor(step.verdict)} bg-transparent border-current`}>
                    {getVerdictIcon(step.verdict)} {getVerdictLabel(step.verdict)}
                  </Badge>
                  {step.error_type && (
                    <Badge variant="warning">{step.error_type}</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">
                  <ReactMarkdown>{step.explanation}</ReactMarkdown>
                </p>
                {step.fix && (
                  <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-sm text-blue-300">
                      <span className="font-semibold text-blue-400">Fix:</span> <span className="inline"><ReactMarkdown>{step.fix}</ReactMarkdown></span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-[#0f1628]/50 border-emerald-500/20">
          <CardTitle className="text-sm mb-3 text-emerald-400 flex items-center gap-2">
            <span>✨</span> Model Solution
          </CardTitle>
          <div className="prose prose-sm prose-invert prose-emerald max-w-none">
            <ReactMarkdown>{evaluation.model_solution}</ReactMarkdown>
          </div>
        </Card>

        {evaluation.source_citations.length > 0 && (
          <Card className="bg-[#0f1628]/50 border-blue-500/20">
            <CardTitle className="text-sm mb-3 text-blue-400 flex items-center gap-2">
              <span>📚</span> Sources Used
            </CardTitle>
            <ul className="space-y-2">
              {evaluation.source_citations.map((cite, i) => (
                <li key={i} className="text-sm text-gray-300 flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
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
