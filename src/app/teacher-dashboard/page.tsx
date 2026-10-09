"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import Loader from "@/components/ui/Loader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { getTeacherSessions, getTeacherByUid } from "@/lib/firestore";
import type { SessionRecord, TeacherProfile } from "@/types";
import { formatTime, formatDate } from "@/lib/utils";

export default function TeacherDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!user || profile?.role !== "teacher") {
        router.replace("/login");
      } else {
        fetchData();
      }
    }
  }, [user, profile, authLoading, router]);

  const fetchData = async () => {
    if (!user) return;
    try {
      const t = await getTeacherByUid(user.uid);
      if (t) {
        setTeacher(t);
        const s = await getTeacherSessions(t.id);
        setSessions(s);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) return <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center"><Loader size="lg" /></div>;

  const pending = sessions.filter(s => s.status === "pending");
  const past = sessions.filter(s => s.status === "completed");

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <Sidebar />
      <div className="lg:ml-64">
        <TopBar title="Teacher Dashboard" />
        <main className="p-6 max-w-5xl mx-auto space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-[#0f1628]/80">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Doubts Resolved</div>
              <div className="text-3xl font-bold text-white">{teacher?.doubtsResolved || 0}</div>
            </Card>
            <Card className="bg-[#0f1628]/80">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Your Rating</div>
              <div className="text-3xl font-bold text-amber-400">⭐ {teacher?.rating?.toFixed(1) || "N/A"}</div>
            </Card>
            <Card className="bg-[#0f1628]/80">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</div>
              <div className="flex items-center gap-2 mt-2">
                 <div className={`w-3 h-3 rounded-full ${teacher?.availability ? "bg-emerald-500" : "bg-red-500"}`} />
                 <span className="font-medium text-white">{teacher?.availability ? "Available" : "Busy"}</span>
              </div>
            </Card>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Pending Requests</h2>
            {pending.length === 0 ? (
              <Card className="bg-white/[0.02] text-center py-8 text-gray-500">No pending session requests.</Card>
            ) : (
              <div className="space-y-3">
                {pending.map(s => (
                  <Card key={s.id} className="bg-blue-500/10 border-blue-500/30 flex justify-between items-center p-4">
                    <div>
                      <h4 className="font-medium text-white">{s.doubtContext.topic}</h4>
                      <p className="text-sm text-gray-400">Requested at {formatTime(s.createdAt)}</p>
                    </div>
                    <Button onClick={() => router.push(`/session/${s.id}`)}>Join Session</Button>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Past Sessions</h2>
            {past.length === 0 ? (
              <Card className="bg-white/[0.02] text-center py-8 text-gray-500">No past sessions yet.</Card>
            ) : (
              <div className="space-y-3">
                {past.slice(0, 10).map(s => (
                  <Card key={s.id} className="bg-white/[0.02] p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-white">{s.doubtContext.topic}</h4>
                      <span className="text-xs text-gray-500">{formatDate(s.createdAt)}</span>
                    </div>
                    {s.summary && (
                      <div className="text-sm text-gray-400 mt-2 bg-black/20 p-3 rounded-lg">
                        <p className="mb-1"><span className="text-gray-500">Root Cause:</span> {s.summary.root_cause}</p>
                        <p><span className="text-gray-500">Resolution:</span> {s.summary.explanation_that_worked}</p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>

        </main>
      </div>
    </div>
  );
}
