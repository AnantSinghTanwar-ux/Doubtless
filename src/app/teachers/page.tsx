"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import TeacherCard from "@/components/teachers/TeacherCard";
import type { DoubtRouterResult, MatchResponse } from "@/types";
import { requestSession } from "@/lib/sessionRequest";
import { Users } from "lucide-react";

function TeachersContent() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic") || "";
  const question = searchParams.get("q") || "";

  // The Ask page passes its whole diagnosis, so teachers are ranked for this exact doubt.
  const routerResult = useMemo<DoubtRouterResult | null>(() => {
    if (!topic) return null;
    const confidence = Number(searchParams.get("confidence"));
    return {
      topic,
      subtopic: searchParams.get("subtopic") || "",
      difficulty: searchParams.get("difficulty") || "medium",
      doubt_type: (searchParams.get("type") as DoubtRouterResult["doubt_type"]) || "needs_human",
      confidence: Number.isFinite(confidence) && searchParams.get("confidence") ? confidence : 0.5,
      route: "teacher",
      reasoning: "",
    };
  }, [searchParams, topic]);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MatchResponse | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !profile)) {
      router.replace("/login");
    }
  }, [user, profile, authLoading, router]);

  useEffect(() => {
    let alive = true;
    fetch("/api/teachers/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routerResult, question, limit: routerResult ? 4 : 10 }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: MatchResponse | null) => alive && setData(d))
      .catch((err) => console.error(err))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [routerResult, question]);

  const handleRequestSession = async (teacherId: string) => {
    if (!user) return;
    setRequestingId(teacherId);
    try {
      router.push(`/session/${await requestSession({ studentId: user.uid, teacherId, routerResult, question })}`);
    } catch (err) {
      console.error(err);
      alert("Failed to create session.");
      setRequestingId(null);
    }
  };

  if (authLoading) return null;

  const [best, ...rest] = data?.matches ?? [];
  const none = !loading && (data?.matches.length ?? 0) === 0;

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar />
      <div className="lg:ml-64">
        <TopBar title={topic ? `Teachers for ${topic}` : "Teachers"} />
        <main id="main" className="mx-auto max-w-6xl p-4 pb-24 md:p-6 md:pb-24 lg:pb-8 [&>*]:max-w-4xl">
          <div className="mb-8">
            <h2 className="display text-2xl text-ink mb-2">Talk to a real teacher</h2>
            <p className="text-sm text-muted mb-6">
              One-to-one help over live video and chat.{topic ? ` Ranked for your ${topic} doubt by experience, student reviews and track record.` : " Best-reviewed teachers first."}
            </p>

            {loading ? (
              <div className="py-12"><Loader text="Finding the best teacher..." /></div>
            ) : none ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center rounded-card border border-dashed border-line px-6 py-16 text-center">
                  <Users className="mb-3 h-8 w-8 text-faint" aria-hidden />
                  <p className="font-medium text-ink">{topic ? `No ${topic} teacher is online right now` : "No teachers are online right now"}</p>
                  <p className="mt-1 max-w-sm text-sm text-faint">Teachers appear here the moment they go online. Meanwhile, the AI tutor can explain your doubt step by step.</p>
                  <Button className="mt-5" variant="accent" onClick={() => router.push("/ask")}>
                    Ask the AI tutor
                  </Button>
                </div>
                {(data?.offlineExperts.length ?? 0) > 0 && (
                  <>
                    <h3 className="font-display text-lg font-semibold text-ink">Best fit, but offline</h3>
                    {data!.offlineExperts.map((m) => (
                      <TeacherCard key={m.teacher.id} match={m} onRequestSession={handleRequestSession} loading={false} />
                    ))}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="mb-4 font-display text-lg font-semibold text-ink">{topic ? `Best match for ${topic}` : "Teachers online"}</h3>
                <TeacherCard featured={!!topic} match={best} onRequestSession={handleRequestSession} loading={requestingId === best.teacher.id} />
                {rest.length > 0 && <h3 className="pt-2 font-display text-lg font-semibold text-ink">Also online</h3>}
                {rest.map((m) => (
                  <TeacherCard key={m.teacher.id} match={m} onRequestSession={handleRequestSession} loading={requestingId === m.teacher.id} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

export default function TeachersPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader size="lg" /></div>}>
      <TeachersContent />
    </Suspense>
  );
}
