"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";
import Loader from "@/components/ui/Loader";
import WeakTopics from "@/components/dashboard/WeakTopics";
import Card from "@/components/ui/Card";
import { getLearnerProfile } from "@/lib/firestore";
import type { LearnerProfile } from "@/types";

export default function DashboardPage() {
  const { user, profile: authProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [learnerProfile, setLearnerProfile] = useState<LearnerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!user || !authProfile) {
        router.replace("/login");
      } else if (authProfile.role === "teacher") {
        router.replace("/teacher-dashboard");
      } else {
        fetchProfile();
      }
    }
  }, [user, authProfile, authLoading, router]);

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const p = await getLearnerProfile(user.uid);
      setLearnerProfile(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (!learnerProfile) return null;

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar />
      <div className="lg:ml-64">
        <TopBar title="Dashboard" />
        <main className="p-4 md:p-6 pb-24 lg:pb-6 max-w-6xl mx-auto space-y-6">
          
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Welcome back, {authProfile?.displayName?.split(" ")[0]}</h2>
              <p className="text-gray-400 text-sm mt-1">Here's your learning progress today.</p>
            </div>
            <div className="hidden md:flex gap-4">
              <button onClick={() => router.push("/ask")} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-white hover:bg-white/10 transition">
                Ask Doubt
              </button>
              <button onClick={() => router.push("/solve")} className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-xl text-sm font-medium text-blue-400 hover:bg-blue-500/30 transition">
                Solve Problem
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-semibold">Total Doubts</div>
              <div className="text-3xl font-bold text-white">{learnerProfile.totalDoubtsResolved}</div>
            </Card>
            <Card>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-semibold">AI Resolved</div>
              <div className="text-3xl font-bold text-white">{learnerProfile.aiResolved}</div>
            </Card>
            <Card>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-semibold">Practice Resolved</div>
              <div className="text-3xl font-bold text-white">{learnerProfile.practiceResolved}</div>
            </Card>
            <Card>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-semibold">Teacher Resolved</div>
              <div className="text-3xl font-bold text-white">{learnerProfile.teacherResolved}</div>
            </Card>
          </div>

          <WeakTopics profile={learnerProfile} />

        </main>
      </div>
      <BottomNav />
    </div>
  );
}
