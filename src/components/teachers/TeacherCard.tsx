"use client";

import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { BadgeCheck, Lightbulb, Star } from "lucide-react";
import type { TeacherMatch, TeacherProfile } from "@/types";

interface TeacherCardProps {
  match?: TeacherMatch;
  teacher?: TeacherProfile;
  onRequestSession: (teacherId: string) => void;
  loading: boolean;
}

export default function TeacherCard({ match, teacher: rawTeacher, onRequestSession, loading }: TeacherCardProps) {
  const teacher = match?.teacher || rawTeacher;
  if (!teacher) return null;

  return (
    <Card>
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex flex-none flex-row items-center gap-4 md:flex-col md:gap-3">
          {teacher.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={teacher.photoURL} alt={teacher.name} className="h-20 w-20 rounded-xl object-cover ring-1 ring-line" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-ink font-display text-3xl font-semibold text-snow">{teacher.name.charAt(0)}</div>
          )}
          <div className="flex items-center gap-1 text-sm font-medium text-ink">
            <Star className="h-4 w-4 fill-amber-500 text-amber-500" aria-hidden />
            {teacher.ratingCount === 0 ? "New" : teacher.rating.toFixed(1)}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="flex flex-wrap items-center gap-1.5 font-display text-xl font-semibold text-ink">
                {teacher.name}
                {teacher.verified ? (
                  <BadgeCheck className="h-5 w-5 fill-pen text-sheet" aria-label="Verified teacher" />
                ) : (
                  <Badge variant="warning">Unverified</Badge>
                )}
              </h3>
              {teacher.headline && <p className="text-sm text-ink/80">{teacher.headline}</p>}
              <p className="text-sm text-muted">{teacher.subjects.join(", ")}</p>
            </div>
            {match && (
              <Badge variant="success" className="shrink-0">
                {match.score}% match
              </Badge>
            )}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {teacher.specialties.map((spec) => (
              <Badge key={spec} variant="default">
                {spec}
              </Badge>
            ))}
          </div>

          <div className="flex flex-col items-stretch justify-between gap-4 border-t border-line pt-4 md:flex-row md:items-center">
            <div className="flex-1 text-sm">
              {match ? (
                <div className="flex items-start gap-2">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-pen" aria-hidden />
                  <span className="text-ink/80">{match.explanation}</span>
                </div>
              ) : (
                <span className="text-muted">{teacher.doubtsResolved} doubts resolved</span>
              )}
            </div>

            <Button onClick={() => onRequestSession(teacher.id)} disabled={!teacher.availability || loading} loading={loading} className="w-full md:w-auto">
              {teacher.availability ? "Request a session" : "Busy right now"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
