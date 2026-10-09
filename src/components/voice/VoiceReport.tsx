"use client";

import { AlertTriangle, CheckCircle2, Mic, Sparkles, Target, XCircle } from "lucide-react";
import Card, { CardTitle } from "@/components/ui/Card";
import Callout from "@/components/ui/Callout";
import { getScoreColor } from "@/lib/utils";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import type { VoiceEvaluation } from "@/types";

interface VoiceReportProps {
  evaluation: VoiceEvaluation;
}

export default function VoiceReport({ evaluation }: VoiceReportProps) {
  const chartData = [
    { subject: "Accuracy", A: evaluation.content_accuracy, fullMark: 10 },
    { subject: "Structure", A: evaluation.structure, fullMark: 10 },
    { subject: "Clarity", A: evaluation.clarity, fullMark: 10 },
    { subject: "Confidence", A: evaluation.confidence_score, fullMark: 10 },
  ];

  const overallScore = Math.round(
    (evaluation.content_accuracy + evaluation.structure + evaluation.clarity + evaluation.confidence_score) / 4
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="flex min-h-[300px] flex-col items-center justify-center md:col-span-1">
          <h3 className="mb-2 text-sm font-medium text-muted">Feynman score</h3>
          <div className={`display tabular mb-4 text-6xl ${getScoreColor(overallScore)}`}>
            {overallScore}
            <span className="text-2xl text-faint">/10</span>
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                <PolarGrid stroke="rgba(20,33,61,0.15)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#4d5870", fontSize: 12 }} />
                <Radar name="Score" dataKey="A" stroke="#c2410c" fill="#c2410c" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="space-y-6 md:col-span-2">
          <div>
            <CardTitle className="mb-3 flex items-center gap-2 text-base">
              <Mic className="h-4 w-4 text-pen" aria-hidden /> Delivery analysis
            </CardTitle>
            <p className="rounded-xl border border-line bg-paper p-4 text-sm leading-relaxed text-ink/85">{evaluation.filler_analysis}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-paper p-4">
              <h4 className="mb-2 text-sm font-medium text-muted">Where you hesitated</h4>
              {evaluation.where_they_hesitated.length > 0 ? (
                <ul className="space-y-1.5">
                  {evaluation.where_they_hesitated.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink/85">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden /> {point}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> None detected
                </p>
              )}
            </div>

            <div className="rounded-xl border border-line bg-paper p-4">
              <h4 className="mb-2 text-sm font-medium text-muted">Concepts you missed</h4>
              {evaluation.missing_concepts.length > 0 ? (
                <ul className="space-y-1.5">
                  {evaluation.missing_concepts.map((concept, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink/85">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-margin" aria-hidden /> {concept}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> Covered every key point
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card glow>
        <CardTitle className="mb-4 flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-pen" aria-hidden /> How a top student would explain it
        </CardTitle>
        <blockquote className="border-l-2 border-pen/50 py-1 pl-4 text-sm italic leading-relaxed text-ink/85">{evaluation.better_explanation}</blockquote>
      </Card>

      <Callout tone="success" icon={Target} title="Your one tip">
        {evaluation.one_sentence_tip}
      </Callout>
    </div>
  );
}
