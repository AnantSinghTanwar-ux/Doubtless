"use client";

import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { BadgeCheck, CheckCircle2, Star } from "lucide-react";
import { isOnline } from "@/lib/teacherRanking";
import { cn } from "@/lib/utils";
import type { TeacherMatch, TeacherProfile } from "@/types";

interface TeacherCardProps {
  match?: TeacherMatch;
  teacher?: TeacherProfile;
  onRequestSession: (teacherId: string) => void;
  loading: boolean;
  /** The single best recommendation: shown larger, with the reasoning spelled out. */
  featured?: boolean;
}

const gradeLabel = (g: number) => (g >= 13 ? "college" : `class ${g}`);

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 text-muted">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10" role="img" aria-label={`${label} ${value.toFixed(1)} out of 5`}>
        <div className="h-full rounded-full bg-pen" style={{ width: `${(value / 5) * 100}%` }} />
      </div>
      <span className="tabular w-7 text-right font-medium text-ink">{value.toFixed(1)}</span>
    </div>
  );
}

export default function TeacherCard({ match, teacher: rawTeacher, onRequestSession, loading, featured }: TeacherCardProps) {
  const teacher = match?.teacher || rawTeacher;
  if (!teacher) return null;

  const online = match?.online ?? isOnline(teacher);
  const e = match?.evidence;
  const rs = teacher.reviewStats;
  const reviewed = (rs?.n ?? 0) > 0;

  return (
    <Card className={cn(featured && "ring-2 ring-pen/40")}>
      {featured && (
        <p className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-pen">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Best match for this doubt
        </p>
      )}
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex flex-none flex-row items-center gap-4 md:flex-col md:gap-3">
          <div className="relative">
            {teacher.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={teacher.photoURL} alt={teacher.name} className="h-20 w-20 rounded-xl object-cover ring-1 ring-line" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-ink font-display text-3xl font-semibold text-snow">{teacher.name.charAt(0)}</div>
            )}
            <span
              className={cn("absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-sheet", online ? "bg-emerald-500" : "bg-faint")}
              title={online ? "Online now" : "Offline"}
              aria-label={online ? "Online now" : "Offline"}
            />
          </div>
          <div className="flex items-center gap-1 text-sm font-medium text-ink">
            <Star className="h-4 w-4 fill-amber-500 text-amber-500" aria-hidden />
            {reviewed ? teacher.rating.toFixed(1) : "New"}
            {reviewed && <span className="font-normal text-muted">({rs!.n})</span>}
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
              <p className="text-xs text-faint">
                {Object.keys(teacher.subjectGrades ?? {}).length
                  ? `Teaches ${Object.entries(teacher.subjectGrades!)
                      .map(([s, r]) => `${s}: ${gradeLabel(r.from)}${r.to !== r.from ? `-${gradeLabel(r.to)}` : ""}`)
                      .join(" · ")}`
                  : "Grades not listed yet"}
              </p>
            </div>
            {match && (
              <div className="shrink-0 text-right">
                <Badge variant="success">{match.score}% match</Badge>
                {e && (
                  <p className="mt-1.5 text-xs leading-5 text-muted">
                    Skill fit {Math.round(e.skillFit * 100)}%
                    <br />
                    {e.isNew ? "New, no reviews yet" : `Track record ${Math.round(e.trackRecord * 100)}%`}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {teacher.specialties.map((spec) => (
              <Badge key={spec} variant={e?.matchedSpecialties.includes(spec) ? "info" : "default"}>
                {spec}
              </Badge>
            ))}
          </div>

          {reviewed && (
            <div className="mb-4 space-y-1.5 rounded-xl border border-line bg-paper p-3">
              <Bar label="Explains" value={rs!.explain / rs!.n} />
              <Bar label="Basics" value={rs!.depth / rs!.n} />
              <Bar label="Solves" value={rs!.solving / rs!.n} />
              {rs!.n >= 3 && <p className="pt-1 text-xs text-muted">{Math.round((rs!.resolved / rs!.n) * 100)}% of students say their doubt was resolved</p>}
            </div>
          )}

          <div className="flex flex-col items-stretch justify-between gap-4 border-t border-line pt-4 md:flex-row md:items-center">
            <div className="flex-1 text-sm">
              {match?.reasons?.length ? (
                <ul className="space-y-1">
                  {match.reasons.slice(0, featured ? 5 : 3).map((r) => (
                    <li key={r} className="flex items-start gap-2 text-ink/80">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-pen" aria-hidden />
                      {r}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted">{teacher.doubtsResolved} doubts resolved</span>
              )}
            </div>

            <Button onClick={() => onRequestSession(teacher.id)} disabled={!online || loading} loading={loading} className="w-full md:w-auto">
              {online ? "Request a session" : "Offline right now"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
