"use client";

import Card, { CardDescription, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { LearnerProfile } from "@/types";
import { useRouter } from "next/navigation";
import { Sprout } from "lucide-react";

interface WeakTopicsProps {
  profile: LearnerProfile;
}

export default function WeakTopics({ profile }: WeakTopicsProps) {
  const router = useRouter();

  // Find topics with lowest mastery, or from recent failed interactions
  const weakTopics = Object.entries(profile.topicMastery)
    .filter(([, score]) => score < 60)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3);

  // If no explicitly weak topics, look for recent mistakes
  const frequentMistakes = Object.entries(profile.mistakeFrequencies)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2);

  const handlePractice = (topic: string) => {
    router.push(`/practice?topic=${encodeURIComponent(topic)}`);
  };

  const row = "flex items-center justify-between gap-3 rounded-xl border border-line bg-paper p-3.5";

  return (
    <Card>
      <CardTitle>Focus areas</CardTitle>
      <CardDescription className="mb-4">Topics where a little practice will help most.</CardDescription>

      {weakTopics.length === 0 && frequentMistakes.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700">
            <Sprout className="h-5 w-5" aria-hidden />
          </span>
          <p className="font-medium text-ink">No weak areas yet</p>
          <p className="mt-1 max-w-xs text-sm text-muted">As you ask doubts and practise, the topics that need work will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {weakTopics.map(([topic, score]) => (
            <div key={topic} className={row}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{topic}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-ink/10">
                    <div className="h-full rounded-full bg-pen" style={{ width: `${Math.max(4, score)}%` }} />
                  </div>
                  <p className="tabular text-xs text-muted">{score}% mastery</p>
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => handlePractice(topic)}>
                Practise
              </Button>
            </div>
          ))}

          {frequentMistakes.length > 0 && weakTopics.length < 3 && (
            <div className="pt-2">
              <p className="mb-2 text-sm font-medium text-muted">Mistakes you repeat</p>
              {frequentMistakes.map(([mistake, count]) => (
                <div key={mistake} className={`${row} mb-2`}>
                  <p className="text-sm font-medium capitalize text-ink">{mistake.replace(/_/g, " ")}</p>
                  <p className="tabular text-xs text-muted">
                    {count} {count === 1 ? "time" : "times"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
