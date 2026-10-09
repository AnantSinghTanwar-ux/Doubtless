"use client";

import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import TeacherCard from "@/components/teachers/TeacherCard";
import type { TeacherMatch, TeacherProfile } from "@/types";
import { createSession } from "@/lib/firestore";
import { generateJitsiRoom } from "@/lib/utils";
import { Users } from "lucide-react";

function TeachersContent() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic");

  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<TeacherMatch[]>([]);
  const [allTeachers, setAllTeachers] = useState<TeacherProfile[]>([]);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !profile)) {
      router.replace("/login");
    }
  }, [user, profile, authLoading, router]);

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        if (topic) {
          const res = await fetch("/api/teachers/match", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ routerResult: { topic } }) // Mock router result for matching
          });
          if (res.ok) {
            const data = await res.json();
            setMatches(data.matches);
          }
        } else {
          // Just fetch all available
          const res = await fetch("/api/teachers/match", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ routerResult: { topic: "General" } })
          });
          if (res.ok) {
             const data = await res.json();
             setAllTeachers(data.matches.map((m: TeacherMatch) => m.teacher));
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTeachers();
  }, [topic]);

  const handleRequestSession = async (teacherId: string) => {
    if (!user) return;
    setRequestingId(teacherId);
    try {
      const sessionId = await createSession({
        studentId: user.uid,
        teacherId,
        doubtId: "manual-request", // Placeholder if no explicit doubt
        status: "pending",
        jitsiRoom: generateJitsiRoom(user.uid),
        doubtContext: {
          topic: topic || "General",
          subtopic: "",
          difficulty: "medium",
          doubt_type: "needs_human",
          confidence: 0,
          route: "teacher",
          reasoning: "Student manually requested teacher session."
        },
        createdAt: Date.now()
      });
      
      router.push(`/session/${sessionId}`);
    } catch (err) {
      console.error(err);
      alert("Failed to create session.");
      setRequestingId(null);
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar />
      <div className="lg:ml-64">
        <TopBar title={topic ? `Teachers for ${topic}` : "Teachers"} />
        <main id="main" className="mx-auto max-w-6xl p-4 pb-24 md:p-6 md:pb-24 lg:pb-8 [&>*]:max-w-4xl">
          
          <div className="mb-8">
            <h2 className="display text-2xl text-ink mb-2">Talk to a real teacher</h2>
            <p className="text-sm text-muted mb-6">
              One-to-one help over live video and chat.
            </p>

            {loading ? (
              <div className="py-12"><Loader text="Finding best teachers..." /></div>
            ) : topic && matches.length > 0 ? (
              <div className="space-y-4">
                <h3 className="mb-4 font-display text-lg font-semibold text-ink">Best matches for {topic}</h3>
                {matches.map(match => (
                  <TeacherCard 
                    key={match.teacher.id} 
                    match={match} 
                    onRequestSession={handleRequestSession}
                    loading={requestingId === match.teacher.id}
                  />
                ))}
              </div>
            ) : allTeachers.length === 0 && matches.length === 0 ? (
              <div className="flex flex-col items-center rounded-card border border-dashed border-line px-6 py-16 text-center">
                <Users className="mb-3 h-8 w-8 text-faint" aria-hidden />
                <p className="font-medium text-ink">No teachers are online right now</p>
                <p className="mt-1 max-w-sm text-sm text-faint">
                  Verified teachers appear here the moment they go online. Meanwhile, the AI tutor can explain your doubt step by step.
                </p>
                <Button className="mt-5" variant="accent" onClick={() => router.push("/ask")}>
                  Ask the AI tutor
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="mb-4 font-display text-lg font-semibold text-ink">Teachers online</h3>
                {allTeachers.map(teacher => (
                  <TeacherCard 
                    key={teacher.id} 
                    teacher={teacher} 
                    onRequestSession={handleRequestSession}
                    loading={requestingId === teacher.id}
                  />
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
