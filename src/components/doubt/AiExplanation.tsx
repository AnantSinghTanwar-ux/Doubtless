"use client";

import Card, { CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ReactMarkdown from 'react-markdown';

interface AiExplanationProps {
  explanation: {
    explanation: string;
    key_concepts: string[];
    analogies?: string[];
    follow_up_questions?: string[];
    based_on_past_session?: boolean;
  };
}

export default function AiExplanation({ explanation }: AiExplanationProps) {
  return (
    <div className="space-y-6">
      {explanation.based_on_past_session && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <span className="text-amber-400 text-xl">💡</span>
          <div>
            <h4 className="text-amber-400 font-medium text-sm">Enhanced by past teacher sessions</h4>
            <p className="text-amber-400/80 text-xs mt-1">
              This explanation incorporates successful strategies used by expert teachers for similar doubts.
            </p>
          </div>
        </div>
      )}

      <Card className="bg-[#0f1628]/80">
        <div className="prose prose-invert prose-blue max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10">
          <ReactMarkdown>{explanation.explanation}</ReactMarkdown>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {explanation.key_concepts.length > 0 && (
          <Card className="bg-[#0f1628]/50">
            <CardTitle className="text-sm mb-3 text-blue-400 flex items-center gap-2">
              <span>🔑</span> Key Concepts
            </CardTitle>
            <ul className="space-y-2">
              {explanation.key_concepts.map((concept, i) => (
                <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span> {concept}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {explanation.analogies && explanation.analogies.length > 0 && (
          <Card className="bg-[#0f1628]/50">
            <CardTitle className="text-sm mb-3 text-emerald-400 flex items-center gap-2">
              <span>🧠</span> Helpful Analogies
            </CardTitle>
            <ul className="space-y-2">
              {explanation.analogies.map((analogy, i) => (
                <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span> {analogy}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {explanation.follow_up_questions && explanation.follow_up_questions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Test your understanding</h4>
          <div className="grid gap-2">
            {explanation.follow_up_questions.map((q, i) => (
              <div key={i} className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] text-sm text-gray-300 hover:bg-white/[0.04] transition-colors cursor-pointer">
                {q}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
