"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Callout from "@/components/ui/Callout";
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import TeacherCard from "@/components/teachers/TeacherCard";
import { requestSession } from "@/lib/sessionRequest";
import type { DoubtRouterResult, MatchResponse } from "@/types";

/**
 * "Best teacher for this doubt": ranks teachers on subject fit, what students say about their explaining and
 * problem solving, and their record, then lets the student request the top pick (or an alternative) in one click.
 */
export default function RecommendedTeachers({ routerResult, question, onTryAi }: { routerResult: DoubtRouterResult; question: string; onTryAi?: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<MatchResponse | null>(null);
  const [error, setError] = useState("");
  const [requesting, setRequesting] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/teachers/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ routerResult, question }) })
      .then(async (r) => (r.ok ? ((await r.json()) as MatchResponse) : Promise.reject(new Error((await r.json().catch(() => ({}))).error || "Couldn't load teachers"))))
      .then((d) => alive && (setError(""), setData(d)))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Couldn't load teachers"));
    return () => {
      alive = false;
    };
  }, [routerResult, question]);

  const request = async (teacherId: string) => {
    if (!user) return;
    setRequesting(teacherId);
    try {
      router.push(`/session/${await requestSession({ studentId: user.uid, teacherId, routerResult, question })}`);
    } catch {
      setError("Couldn't start the session. Please try again.");
      setRequesting(null);
    }
  };

  const hard = routerResult.difficulty === "hard";
  const [best, ...others] = data?.matches ?? [];

  return (
    <section aria-label="Recommended teacher" className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
          <Sparkles className="h-5 w-5 text-pen" aria-hidden /> {hard ? "This is a tough one. Here's who to ask" : "A teacher who can help with this"}
        </h3>
        <p className="mt-1 text-sm text-muted">
          Ranked on {routerResult.topic} experience, what students say about how they explain and solve, and their track record
          {hard ? ". For hard doubts, problem-solving counts most." : "."}
        </p>
      </div>

      {!data && !error && <Loader size="sm" text="Finding the best teacher..." />}
      {error && <Callout tone="error" title="Couldn't load recommendations">{error}</Callout>}

      {best && (
        <>
          <TeacherCard featured match={best} onRequestSession={request} loading={requesting === best.teacher.id} />
          {others.length > 0 && <p className="pt-1 text-sm font-medium text-ink">Also online</p>}
          {others.map((m) => (
            <TeacherCard key={m.teacher.id} match={m} onRequestSession={request} loading={requesting === m.teacher.id} />
          ))}
        </>
      )}

      {data && !best && (
        <>
          <Callout tone="warning" icon={Clock} title={`No ${routerResult.topic} teacher is online right now`}>
            {data.offlineExperts.length > 0 ? "The best fit is offline at the moment. Meanwhile you can get an AI explanation or practise." : "Try the AI explanation or practice for now, and check back soon."}
          </Callout>
          {data.offlineExperts.map((m) => (
            <TeacherCard key={m.teacher.id} match={m} onRequestSession={request} loading={false} />
          ))}
          {onTryAi && (
            <Button variant="secondary" onClick={onTryAi}>
              Get an AI explanation meanwhile
            </Button>
          )}
        </>
      )}
    </section>
  );
}
