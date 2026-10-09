"use client";

import Card, { CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { LearnerProfile } from "@/types";
import { useRouter } from "next/navigation";

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

  return (
    <Card className="bg-gradient-to-br from-red-500/10 to-orange-600/10 border-red-500/20">
      <CardTitle className="text-sm mb-4 text-red-400 flex items-center gap-2">
        <span className="text-red-400">🎯</span> Focus Areas
      </CardTitle>

      {weakTopics.length === 0 && frequentMistakes.length === 0 ? (
        <div className="text-center py-6">
          <span className="text-2xl mb-2 block">🌟</span>
          <p className="text-sm text-emerald-400">You're doing great! No weak areas identified yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {weakTopics.map(([topic, score]) => (
            <div key={topic} className="flex items-center justify-between bg-white/[0.05] p-3 rounded-xl border border-white/[0.03]">
              <div>
                <p className="text-sm font-medium text-white">{topic}</p>
                <p className="text-xs text-red-400">Mastery: {score}%</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => handlePractice(topic)} className="text-xs py-1.5 h-auto">
                Practice
              </Button>
            </div>
          ))}

          {frequentMistakes.length > 0 && weakTopics.length < 3 && (
            <div className="pt-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Frequent Mistakes</p>
              {frequentMistakes.map(([mistake, count]) => (
                <div key={mistake} className="flex items-center justify-between bg-white/[0.05] p-3 rounded-xl border border-white/[0.03] mb-2">
                  <div>
                    <p className="text-sm font-medium text-white capitalize">{mistake.replace(/_/g, " ")}</p>
                    <p className="text-xs text-amber-400">Occurred {count} times</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
