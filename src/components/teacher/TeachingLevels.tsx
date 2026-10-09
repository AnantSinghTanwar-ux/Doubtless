"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import GradeRanges from "./GradeRanges";
import { updateTeacher } from "@/lib/firestore";
import type { GradeRange, TeacherProfile } from "@/types";

/** Lets a teacher set or change which grades they teach per subject, so students are matched at the right level. */
export default function TeachingLevels({ teacher }: { teacher: TeacherProfile }) {
  const [value, setValue] = useState<Record<string, GradeRange>>(teacher.subjectGrades ?? {});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await updateTeacher(teacher.id, { subjectGrades: Object.fromEntries(teacher.subjects.map((s) => [s, value[s] ?? { from: 6, to: 12 }])) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-sheet p-5">
      <div>
        <h4 className="font-medium text-ink">Grades you teach</h4>
        <p className="text-sm text-muted">Roughly, per subject (13 = college). Students are matched to teachers at their level.</p>
      </div>
      <GradeRanges subjects={teacher.subjects} value={value} onChange={(v) => { setValue(v); setSaved(false); }} />
      <Button size="sm" onClick={save} loading={busy}>{saved ? "Saved" : "Save levels"}</Button>
    </div>
  );
}
