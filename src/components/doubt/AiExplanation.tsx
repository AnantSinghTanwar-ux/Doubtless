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

      <div className="paper paper-plain slide-up px-7 pb-8 pt-7 sm:px-10">
        <p className="hand ink-blue mb-3 text-3xl leading-none">Here&apos;s how I&apos;d explain it</p>
        <div className="serif text-[16px] leading-[1.85] text-[#1b2440] [&_code]:rounded [&_code]:bg-[#1b2440]/10 [&_code]:px-1 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-[#1b2440]/10 [&_pre]:p-3 [&_strong]:font-semibold">
          <ReactMarkdown>{explanation.explanation}</ReactMarkdown>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {explanation.key_concepts.length > 0 && (
          <div className="paper paper-plain slide-up rotate-[-0.6deg] px-6 py-6">
            <p className="hand ink-red mb-2 text-2xl leading-none">Key ideas to remember</p>
            <ul className="space-y-2.5">
              {explanation.key_concepts.map((concept, i) => (
                <li key={i} className="serif text-[15px] leading-7 text-[#1b2440]">
                  <span className="rounded-sm px-0.5" style={{ background: "linear-gradient(transparent 52%, rgba(251,191,36,0.55) 52%)" }}>
                    {concept}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {explanation.analogies && explanation.analogies.length > 0 && (
          <Card className="bg-[#0e0e12]/50">
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
