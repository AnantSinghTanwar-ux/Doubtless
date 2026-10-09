"use client";

import { Bot, Dumbbell, GraduationCap } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { DoubtRouterResult } from "@/types";

interface RouteCardProps {
  result: DoubtRouterResult;
}

const ROUTES = {
  ai_explain: { name: "AI explanation", icon: Bot },
  practice: { name: "Adaptive practice", icon: Dumbbell },
  teacher: { name: "a live teacher", icon: GraduationCap },
} as const;

const TYPES: Record<string, string> = {
  prerequisite_gap: "Prerequisite gap",
  careless_error: "Careless error",
  needs_human: "Needs a teacher",
};

export default function RouteCard({ result }: RouteCardProps) {
  const confidencePercent = Math.round(result.confidence * 100);
  const typeLabel = TYPES[result.doubt_type] ?? "Concept gap";
  const route = ROUTES[result.route as keyof typeof ROUTES] ?? ROUTES.ai_explain;
  const Icon = route.icon;

  return (
    <Card glow>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pen text-snow">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h3 className="font-display text-xl font-semibold text-ink">Routed to {route.name}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="info">{result.topic}</Badge>
              <Badge variant="default">{result.subtopic}</Badge>
              <Badge variant={result.difficulty === "hard" ? "error" : result.difficulty === "medium" ? "warning" : "success"}>{result.difficulty}</Badge>
              <Badge variant="default">{typeLabel}</Badge>
            </div>
          </div>
        </div>

        <div className="shrink-0 md:text-right">
          <span className="mb-1 block text-sm text-muted">How sure we are</span>
          <div className="flex items-center gap-2 md:justify-end">
            <div className="h-2 w-28 overflow-hidden rounded-full bg-ink/10" role="img" aria-label={`Confidence ${confidencePercent}%`}>
              <div className={`h-full rounded-full ${confidencePercent > 75 ? "bg-emerald-600" : confidencePercent > 40 ? "bg-amber-600" : "bg-margin"}`} style={{ width: `${confidencePercent}%` }} />
            </div>
            <span className="tabular text-sm font-medium text-ink">{confidencePercent}%</span>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-line bg-paper p-4">
        <h4 className="mb-1.5 text-sm font-medium text-ink">Why this route</h4>
        <p className="text-sm leading-relaxed text-muted">{result.reasoning}</p>
      </div>
    </Card>
  );
}
