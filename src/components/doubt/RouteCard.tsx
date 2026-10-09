"use client";

import Card, { CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { getRouteColor, getRouteIcon } from "@/lib/utils";
import type { DoubtRouterResult } from "@/types";

interface RouteCardProps {
  result: DoubtRouterResult;
}

export default function RouteCard({ result }: RouteCardProps) {
  const confidencePercent = Math.round(result.confidence * 100);
  
  let typeLabel = "Concept Gap";
  if (result.doubt_type === "prerequisite_gap") typeLabel = "Prerequisite Gap";
  if (result.doubt_type === "careless_error") typeLabel = "Careless Error";
  if (result.doubt_type === "needs_human") typeLabel = "Needs Teacher";

  let routeName = "AI Explanation";
  if (result.route === "practice") routeName = "Adaptive Practice";
  if (result.route === "teacher") routeName = "Live Teacher Session";

  return (
    <Card glow className="border-blue-500/20 bg-gradient-to-br from-[#fffdf8] to-[#f7f4ec]">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{getRouteIcon(result.route)}</span>
            <h3 className={`text-lg font-bold ${getRouteColor(result.route)}`}>
              Routed to {routeName}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge variant="info">{result.topic}</Badge>
            <Badge variant="default">{result.subtopic}</Badge>
            <Badge variant={result.difficulty === "hard" ? "error" : result.difficulty === "medium" ? "warning" : "success"}>
              {result.difficulty}
            </Badge>
            <Badge variant="default">{typeLabel}</Badge>
          </div>
        </div>
        
        <div className="flex flex-col items-end">
          <div className="text-right">
            <span className="text-xs text-gray-500 uppercase tracking-wider block mb-1">AI Confidence</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${confidencePercent > 75 ? 'bg-emerald-500' : confidencePercent > 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${confidencePercent}%` }}
                />
              </div>
              <span className="text-sm font-medium text-white">{confidencePercent}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 p-4 bg-white/[0.05] rounded-xl border border-white/[0.03]">
        <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Why this route?</h4>
        <p className="text-sm text-gray-300 leading-relaxed">{result.reasoning}</p>
      </div>
    </Card>
  );
}
