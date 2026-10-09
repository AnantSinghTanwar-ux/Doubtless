"use client";

import { useEffect, useState } from "react";
import { MessageSquareQuote, Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getTeacherReviews } from "@/lib/firestore";
import type { TeacherProfile, TeacherReview } from "@/types";

const ROWS = [
  ["explain", "How you talk"],
  ["depth", "Your basics"],
  ["solving", "Solving problems"],
] as const;

/** What students say after sessions, summarised, with the latest comments. */
export default function FeedbackPanel({ teacher }: { teacher: TeacherProfile }) {
  const rs = teacher.reviewStats;
  const [reviews, setReviews] = useState<TeacherReview[]>([]);

  useEffect(() => {
    getTeacherReviews(teacher.id, 12).then(setReviews).catch(() => {});
  }, [teacher.id, rs?.n]);

  if (!rs || rs.n === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-6 py-8 text-center">
        <Star className="mx-auto mb-2 h-6 w-6 text-faint" aria-hidden />
        <p className="text-sm font-medium text-ink">No reviews yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">After a session, students can rate how you explain, your basics and how well you solve. Good reviews get you recommended for hard doubts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-sheet p-5">
      <div className="flex items-center gap-2">
        <Star className="h-5 w-5 fill-amber-500 text-amber-500" aria-hidden />
        <span className="font-display text-2xl font-semibold text-ink">{teacher.rating.toFixed(1)}</span>
        <span className="text-sm text-muted">from {rs.n} review{rs.n === 1 ? "" : "s"} · {Math.round((rs.resolved / rs.n) * 100)}% resolved</span>
      </div>
      <div className="space-y-2">
        {ROWS.map(([k, label]) => {
          const v = rs[k] / rs.n;
          return (
            <div key={k} className="flex items-center gap-3 text-sm">
              <span className="w-32 shrink-0 text-muted">{label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
                <div className="h-full rounded-full bg-pen" style={{ width: `${(v / 5) * 100}%` }} />
              </div>
              <span className="tabular w-8 text-right font-medium text-ink">{v.toFixed(1)}</span>
            </div>
          );
        })}
      </div>
      {reviews.filter((r) => r.comment).length > 0 && (
        <ul className="space-y-3 border-t border-line pt-4">
          {reviews.filter((r) => r.comment).slice(0, 4).map((r) => (
            <li key={r.id} className="flex gap-2.5 text-sm">
              <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-pen" aria-hidden />
              <div>
                <p className="text-ink/90">{r.comment}</p>
                <p className="mt-0.5 text-xs text-muted">{r.topic} · {formatDistanceToNow(r.createdAt, { addSuffix: true })}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
