"use client";

import Card, { CardTitle } from "@/components/ui/Card";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { LearnerProfile } from "@/types";
import { useMemo } from "react";
import { format } from "date-fns"; // We don't have date-fns, I'll use native Date formatting

interface DashboardChartsProps {
  profile: LearnerProfile;
}

export default function ScoreTrend({ profile }: DashboardChartsProps) {
  
  const chartData = useMemo(() => {
    // Extract evaluation scores from recent interactions
    const scores = profile.recentInteractions
      .filter(i => i.score !== undefined)
      .reverse() // chronologically
      .map(i => ({
        date: new Date(i.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        score: i.score,
        topic: i.topic
      }));
    
    // If not enough data, pad it so chart doesn't look empty
    if (scores.length === 0) {
      return [
        { date: "Start", score: 0, topic: "None" },
        { date: "Now", score: 0, topic: "None" }
      ];
    }
    if (scores.length === 1) {
       scores.unshift({ date: "Start", score: 0, topic: "None" });
    }
    
    return scores;
  }, [profile.recentInteractions]);

  return (
    <Card className="bg-[#0f1628]/80 col-span-2">
      <CardTitle className="text-sm mb-6 flex items-center gap-2">
        <span className="text-blue-400">📈</span> Overall Score Trend
      </CardTitle>
      
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={12} tickMargin={10} />
            <YAxis stroke="rgba(255,255,255,0.2)" fontSize={12} domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0a0f1e', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
              itemStyle={{ color: '#fff' }}
              labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}
            />
            <Area 
              type="monotone" 
              dataKey="score" 
              stroke="#3b82f6" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorScore)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
