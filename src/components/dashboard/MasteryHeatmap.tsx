"use client";

import Card, { CardTitle } from "@/components/ui/Card";
import type { LearnerProfile } from "@/types";

interface MasteryHeatmapProps {
  profile: LearnerProfile;
}

export default function MasteryHeatmap({ profile }: MasteryHeatmapProps) {
  const topics = Object.entries(profile.topicMastery)
    .sort(([, a], [, b]) => b - a);

  const getMasteryColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500 shadow-emerald-500/20";
    if (score >= 60) return "bg-blue-500 shadow-blue-500/20";
    if (score >= 40) return "bg-amber-500 shadow-amber-500/20";
    return "bg-red-500 shadow-red-500/20";
  };

  return (
    <Card className="bg-[#fffdf8]/80">
      <CardTitle className="text-sm mb-6 flex items-center gap-2">
        <span className="text-purple-400">🗺️</span> Topic Mastery
      </CardTitle>
      
      {topics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <span className="text-3xl mb-2 opacity-50">🧭</span>
          <p className="text-sm text-gray-500">Ask doubts or take practice quizzes to build your mastery map.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {topics.map(([topic, score]) => (
            <div key={topic}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-300 font-medium truncate pr-4">{topic}</span>
                <span className="text-xs text-gray-500">{score}%</span>
              </div>
              <div className="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full shadow-lg ${getMasteryColor(score)}`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
