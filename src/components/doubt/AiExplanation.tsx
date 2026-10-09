"use client";

import { Brain, Lightbulb } from "lucide-react";
import Card, { CardTitle } from "@/components/ui/Card";
import Callout from "@/components/ui/Callout";
import ReactMarkdown from "react-markdown";

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
        <Callout tone="warning" icon={Lightbulb} title="Enhanced by past teacher sessions">
          This explanation uses strategies expert teachers found worked for similar doubts.
        </Callout>
      )}

      <div className="paper paper-plain slide-up px-7 pb-8 pt-7 sm:px-10">
        <p className="hand ink-blue mb-3 text-3xl leading-none">Here&apos;s how I&apos;d explain it</p>
        <div className="serif text-[16px] leading-[1.85] text-[#1b2440] [&_code]:rounded [&_code]:bg-[#1b2440]/10 [&_code]:px-1 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-[#1b2440]/10 [&_pre]:p-3 [&_strong]:font-semibold">
          <ReactMarkdown>{explanation.explanation}</ReactMarkdown>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          <Card>
            <CardTitle className="mb-3 flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-pen" aria-hidden /> Helpful analogies
            </CardTitle>
            <ul className="space-y-2.5">
              {explanation.analogies.map((analogy, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-ink/85">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-pen" aria-hidden />
                  {analogy}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {explanation.follow_up_questions && explanation.follow_up_questions.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-display text-lg font-semibold text-ink">Test your understanding</h4>
          <ul className="grid gap-2">
            {explanation.follow_up_questions.map((q, i) => (
              <li key={i} className="rounded-xl border border-line bg-sheet p-4 text-sm text-ink/85">
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
