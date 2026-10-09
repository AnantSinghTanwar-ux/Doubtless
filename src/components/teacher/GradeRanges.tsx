"use client";

import type { GradeRange } from "@/types";

export const COLLEGE = 13;
const GRADES = Array.from({ length: 13 }, (_, i) => i + 1);
export const DEFAULT_RANGE: GradeRange = { from: 6, to: 12 };

/**
 * One row per subject: roughly which grades the teacher can handle. It lets a grade 5 question go to someone who
 * teaches grade 5 and a college question to someone who teaches college.
 */
export default function GradeRanges({ subjects, value, onChange }: { subjects: string[]; value: Record<string, GradeRange>; onChange: (v: Record<string, GradeRange>) => void }) {
  if (subjects.length === 0) return null;
  const set = (subject: string, patch: Partial<GradeRange>) => {
    const cur = value[subject] ?? DEFAULT_RANGE;
    const next = { ...cur, ...patch };
    if (next.from > next.to) (patch.from !== undefined ? (next.to = next.from) : (next.from = next.to));
    onChange({ ...value, [subject]: next });
  };
  const label = (g: number) => (g === COLLEGE ? "College" : `Grade ${g}`);
  return (
    <div className="space-y-2.5">
      {subjects.map((s) => {
        const r = value[s] ?? DEFAULT_RANGE;
        return (
          <div key={s} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm">
            <span className="min-w-28 font-medium text-ink">{s}</span>
            <span className="text-muted">from</span>
            <select value={r.from} onChange={(e) => set(s, { from: Number(e.target.value) })} aria-label={`${s}: lowest grade`} className="!py-1.5">
              {GRADES.map((g) => (
                <option key={g} value={g}>{label(g)}</option>
              ))}
            </select>
            <span className="text-muted">to</span>
            <select value={r.to} onChange={(e) => set(s, { to: Number(e.target.value) })} aria-label={`${s}: highest grade`} className="!py-1.5">
              {GRADES.map((g) => (
                <option key={g} value={g}>{label(g)}</option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
