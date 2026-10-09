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
    if (score >= 80) return "bg-[#14213d]";
    if (score >= 60) return "bg-[#27324b]";
    if (score >= 40) return "bg-[#556074]";
    return "bg-[#76809a]";
  };

  return (
    <Card>
      <CardTitle className="text-sm mb-6 text-gray-800">
        Topic Mastery
      </CardTitle>
      
      {topics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-gray-500">Ask doubts or take practice quizzes to build your mastery map.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {topics.map(([topic, score]) => (
            <div key={topic}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-800 font-medium truncate pr-4">{topic}</span>
                <span className="text-xs text-gray-500">{score}%</span>
              </div>
              <div className="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full shadow-sm ${getMasteryColor(score)}`}
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
