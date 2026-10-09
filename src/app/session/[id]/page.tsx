"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, useRouter } from "next/navigation";
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import SessionChat from "@/components/teachers/SessionChat";
import VideoCall from "@/components/session/VideoCall";
import ReviewForm from "@/components/session/ReviewForm";
import { getSession, subscribeSession, touchSession, updateSession } from "@/lib/firestore";
import type { SessionRecord } from "@/types";

export default function SessionPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchSession = async () => {
      if (!params.id) return;
      try {
        const s = await getSession(params.id as string);
        if (s) {
          setSession(s);
          // If teacher joins, mark as active
          if (profile?.role === "teacher" && s.status === "pending") {
             await updateSession(s.id, { status: "active", lastActivityAt: Date.now() });
             setSession({ ...s, status: "active" });
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (user && profile) fetchSession();
  }, [params.id, user, profile]);

  // The student follows the session live, so when the teacher ends it they move straight to the review screen.
  const isStudent = profile?.role === "student";
  useEffect(() => {
    if (!params.id || !user || !isStudent) return;
    return subscribeSession(params.id as string, (s) => s && setSession(s));
  }, [params.id, user, isStudent]);

  // Heartbeat: dashboards use this to tell a live session from one that was simply abandoned.
  const sessionId = session?.id;
  const open = session?.status === "pending" || session?.status === "active";
  useEffect(() => {
    if (!sessionId || !open) return;
    void touchSession(sessionId).catch(() => {});
    const timer = setInterval(() => void touchSession(sessionId).catch(() => {}), 30_000);
    return () => clearInterval(timer);
  }, [sessionId, open]);

  const handleEndSession = async () => {
    if (!session || profile?.role !== "teacher") return;
    setSummarizing(true);
    try {
      const res = await fetch("/api/session/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          doubtContext: JSON.stringify(session.doubtContext)
        })
      });

      if (res.ok) {
         router.push("/teacher-dashboard");
      }
    } catch (err) {
      console.error(err);
      setSummarizing(false);
    }
  };

  const handleStudentLeave = () => {
    router.push("/dashboard");
  };

  if (authLoading || loading) {
    return <div className="h-screen bg-transparent flex items-center justify-center"><Loader size="lg" /></div>;
  }

  if (!session) {
    return <div className="text-ink p-8">Session not found.</div>;
  }

  if (session.status === "completed" && isStudent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <ReviewForm session={session} onDone={() => router.push("/dashboard")} />
      </div>
    );
  }

  if (session.status === "completed" || session.status === "expired") {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">This session has ended</h1>
        <p className="max-w-sm text-sm text-muted">
          {session.status === "completed" ? "The teacher wrapped it up and a summary was saved." : "Nobody was in the room for a while, so it was closed."}
        </p>
        <Button onClick={() => router.push(profile?.role === "teacher" ? "/teacher-dashboard" : "/teachers")}>
          {profile?.role === "teacher" ? "Back to dashboard" : "Find a teacher"}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-transparent flex flex-col overflow-hidden">
      <header className="h-16 flex-none bg-sheet border-b border-line px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-pen flex items-center justify-center text-snow font-bold">S</div>
          <div>
            <h1 className="text-sm font-semibold text-ink">Live Session: {session.doubtContext.topic}</h1>
            <p className="text-xs text-muted">
              {session.status === "pending" ? "Waiting for teacher..." : "Session Active"}
            </p>
          </div>
        </div>
        <div>
          {profile?.role === "teacher" ? (
             <Button variant="danger" size="sm" onClick={handleEndSession} loading={summarizing}>
               End Session & Summarize
             </Button>
          ) : (
             <Button variant="ghost" size="sm" onClick={handleStudentLeave}>
               Leave Session
             </Button>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left column: Jitsi & Context */}
        <div className="flex-1 flex flex-col h-full border-r border-line">
          <div className="flex-1 bg-black relative min-h-[240px]">
            {user && <VideoCall sessionId={session.id} uid={user.uid} />}
          </div>
          <div className="h-1/3 min-h-[200px] p-4 bg-sheet overflow-y-auto">
            <h3 className="text-sm font-semibold text-ink mb-3">AI Diagnostic Context</h3>
            <div className="bg-ink/[0.05] rounded-xl p-4 border border-line space-y-2 text-sm">
              <p><span className="text-faint w-24 inline-block">Topic:</span> <span className="text-pen">{session.doubtContext.topic} ({session.doubtContext.subtopic})</span></p>
              <p><span className="text-faint w-24 inline-block">Diagnosis:</span> <span className="text-amber-400">{session.doubtContext.doubt_type}</span></p>
              <p><span className="text-faint w-24 inline-block align-top">Reasoning:</span> <span className="text-ink/80">{session.doubtContext.reasoning}</span></p>
            </div>
          </div>
        </div>

        {/* Right column: Chat */}
        <div className="w-full md:w-80 h-[400px] md:h-full p-4 flex-none">
          <SessionChat sessionId={session.id} />
        </div>
      </div>
    </div>
  );
}
