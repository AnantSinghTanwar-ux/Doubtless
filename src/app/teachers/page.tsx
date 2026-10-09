"use client";

import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";
import Loader from "@/components/ui/Loader";
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
        <TopBar title={topic ? `Teachers for ${topic}` : "Expert Teachers"} />
        <main className="p-4 md:p-6 pb-24 lg:pb-6 max-w-4xl mx-auto">
          
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-2">Connect with an Expert</h2>
            <p className="text-sm text-gray-400 mb-6">
              Get 1-on-1 help in a live video and chat session.
            </p>

            {loading ? (
              <div className="py-12"><Loader text="Finding best teachers..." /></div>
            ) : topic && matches.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-blue-400 uppercase tracking-wider mb-4">Top Matches for {topic}</h3>
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
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/[0.08] px-6 py-16 text-center">
                <Users className="mb-3 h-8 w-8 text-gray-600" />
                <p className="font-medium text-gray-200">No teachers are online right now</p>
                <p className="mt-1 max-w-sm text-sm text-gray-500">
                  Verified teachers appear here the moment they go online. Meanwhile, the AI tutor can explain your doubt step by step.
                </p>
                <button onClick={() => router.push("/ask")} className="mt-5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-snow">
                  Ask the AI tutor
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Available Teachers</h3>
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
    <Suspense fallback={<div className="min-h-screen bg-transparent flex items-center justify-center">Loading...</div>}>
      <TeachersContent />
    </Suspense>
  );
}
