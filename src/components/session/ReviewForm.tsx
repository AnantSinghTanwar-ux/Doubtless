"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import Button from "@/components/ui/Button";
import Callout from "@/components/ui/Callout";
import { authedJSON } from "@/lib/apiClient";
import { getSessionReview, getTeacher } from "@/lib/firestore";
import { cn } from "@/lib/utils";
import type { ReviewResolved, SessionRecord } from "@/types";

const QUESTIONS = [
  { key: "explain", title: "How they talk", hint: "Was the explanation clear and easy to follow?" },
  { key: "depth", title: "Their basics", hint: "Did they know the fundamentals well?" },
  { key: "solving", title: "Solving it", hint: "Could they actually solve your problem?" },
] as const;
type Key = (typeof QUESTIONS)[number]["key"];

function Stars({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => onChange(n)} className="rounded p-0.5">
          <Star className={cn("h-7 w-7 transition-colors", n <= value ? "fill-amber-500 text-amber-500" : "text-line-strong hover:text-amber-400")} />
        </button>
      ))}
    </div>
  );
}

/** Optional feedback after a live session. It is what lets the app recommend the right teacher next time. */
export default function ReviewForm({ session, onDone }: { session: SessionRecord; onDone: () => void }) {
  const [teacherName, setTeacherName] = useState("your teacher");
  const [already, setAlready] = useState<boolean | null>(null);
  const [scores, setScores] = useState<Record<Key, number>>({ explain: 0, depth: 0, solving: 0 });
  const [resolved, setResolved] = useState<ReviewResolved | "">("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    getTeacher(session.teacherId).then((t) => t && setTeacherName(t.name)).catch(() => {});
    getSessionReview(session.id).then((r) => setAlready(!!r)).catch(() => setAlready(false));
  }, [session.id, session.teacherId]);

  const ready = QUESTIONS.every((q) => scores[q.key] > 0) && resolved !== "";

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await authedJSON("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: session.id, ...scores, resolved, comment }) });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your review.");
    } finally {
      setBusy(false);
    }
  };

  if (already === null) return null;

  if (already || sent) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-pen" aria-hidden />
        <h2 className="font-display text-2xl font-semibold text-ink">{sent ? "Thanks for the feedback" : "You've already reviewed this session"}</h2>
        <p className="text-sm text-muted">It helps us recommend the right teacher to the next student with a doubt like yours.</p>
        <Button onClick={onDone}>Done</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 text-left">
      <div className="text-center">
        <h2 className="font-display text-2xl font-semibold text-ink">How was your session with {teacherName}?</h2>
        <p className="mt-1 text-sm text-muted">Optional, and it takes 20 seconds. It shapes who we recommend to other students.</p>
      </div>

      <div className="space-y-4 rounded-card border border-line bg-sheet p-5">
        {QUESTIONS.map((q) => (
          <div key={q.key} className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium text-ink">{q.title}</p>
              <p className="text-xs text-muted">{q.hint}</p>
            </div>
            <Stars value={scores[q.key]} onChange={(n) => setScores((s) => ({ ...s, [q.key]: n }))} label={q.title} />
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 font-medium text-ink">Was your doubt resolved?</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Doubt resolved">
          {([["yes", "Yes"], ["partly", "Partly"], ["no", "No"]] as const).map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={resolved === v} onClick={() => setResolved(v)} className={cn("rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors", resolved === v ? "border-pen bg-pen text-snow" : "border-line bg-sheet text-ink hover:border-pen/50")}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={600} rows={3} placeholder="Anything you'd tell the next student? (optional)" className="w-full resize-none" />

      {error && <Callout tone="error" title="Couldn't save your review">{error}</Callout>}

      <div className="flex items-center justify-between gap-3">
        <button onClick={onDone} className="text-sm text-muted hover:text-ink">Skip</button>
        <Button onClick={submit} disabled={!ready} loading={busy}>Send review</Button>
      </div>
    </div>
  );
}
