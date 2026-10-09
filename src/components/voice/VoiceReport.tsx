"use client";

import Card, { CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import type { VoiceEvaluation, VoiceMetrics } from "@/types";

interface VoiceReportProps {
  evaluation: VoiceEvaluation;
  metrics: VoiceMetrics;
}

export default function VoiceReport({ evaluation, metrics }: VoiceReportProps) {
  
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
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <Card className="md:col-span-1 bg-[#0e0e12]/80 flex flex-col items-center justify-center min-h-[300px]">
          <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-2">Feynman Score</h3>
          <div className="text-6xl font-bold text-white mb-6">
            {overallScore}<span className="text-2xl text-gray-500">/10</span>
          </div>
          
          <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                <Radar name="Score" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="md:col-span-2 bg-[#0e0e12]/80 space-y-6">
          <div>
            <CardTitle className="text-sm mb-3 flex items-center gap-2">
              <span className="text-blue-400">🗣️</span> Delivery Analysis
            </CardTitle>
            <p className="text-sm text-gray-300 leading-relaxed bg-white/[0.02] p-4 rounded-xl border border-white/[0.06]">
              {evaluation.filler_analysis}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.06]">
              <h4 className="text-xs text-gray-500 uppercase mb-2">Hesitation Points</h4>
              {evaluation.where_they_hesitated.length > 0 ? (
                <ul className="space-y-1">
                  {evaluation.where_they_hesitated.map((point, i) => (
                    <li key={i} className="text-sm text-amber-400/90 flex items-start gap-2">
                      <span className="mt-1 text-xs">⚠️</span> {point}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-emerald-400/90 flex items-center gap-2">
                  <span className="text-xs">✅</span> None detected
                </p>
              )}
            </div>

            <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.06]">
              <h4 className="text-xs text-gray-500 uppercase mb-2">Missing Concepts</h4>
              {evaluation.missing_concepts.length > 0 ? (
                <ul className="space-y-1">
                  {evaluation.missing_concepts.map((concept, i) => (
                    <li key={i} className="text-sm text-red-400/90 flex items-start gap-2">
                      <span className="mt-1 text-xs">⭕</span> {concept}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-emerald-400/90 flex items-center gap-2">
                  <span className="text-xs">✅</span> Covered all key points
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-600/10 border-blue-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">🎓</div>
        <div className="relative z-10">
          <CardTitle className="text-sm mb-4 text-blue-400 flex items-center gap-2">
            <span>✨</span> How a Top Student Would Explain It
          </CardTitle>
          <p className="text-sm text-gray-200 leading-relaxed italic border-l-2 border-blue-500/50 pl-4 py-2">
            "{evaluation.better_explanation}"
          </p>
        </div>
      </Card>

      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-4 shadow-lg shadow-emerald-500/5">
        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-xl flex-none">
          🎯
        </div>
        <div>
          <h4 className="text-emerald-400 font-medium text-sm">One Sentence Tip</h4>
          <p className="text-emerald-400/90 text-sm mt-0.5">
            {evaluation.one_sentence_tip}
          </p>
        </div>
      </div>

    </div>
  );
}
