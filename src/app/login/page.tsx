"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import type { UserRole } from "@/types";
import Loader from "@/components/ui/Loader";

export default function LoginPage() {
  const { user, profile, loading, signInWithGoogle, setRole } = useAuth();
  const router = useRouter();
  const [choosingRole, setChoosingRole] = useState(false);
  const [settingRole, setSettingRole] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user && profile) {
      router.replace(profile.role === "teacher" ? "/teacher-dashboard" : "/dashboard");
    } else if (user && !profile) {
      setChoosingRole(true);
    }
  }, [user, profile, loading, router]);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Sign-in failed:", error);
    }
  };

  const handleRoleSelect = async (role: UserRole) => {
    setSettingRole(true);
    try {
      await setRole(role);
      router.replace(role === "teacher" ? "/teacher-dashboard" : "/dashboard");
    } catch (error) {
      console.error("Role selection failed:", error);
      setSettingRole(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      <div className="absolute inset-0 bg-[#0a0f1e]">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[200px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 mb-6 shadow-2xl shadow-blue-500/30 pulse-glow">
            <span className="text-4xl font-bold text-white">D</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Doubtless</h1>
          <p className="text-gray-400 text-lg">AI-Native Education OS</p>
          <p className="text-gray-500 text-sm mt-2">Intelligent doubt resolution for every learner</p>
        </div>

        {!choosingRole ? (
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-8">
            <Button onClick={handleSignIn} size="lg" className="w-full">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="mt-4 flex flex-col gap-3">
              <Button onClick={async () => {
                const res = await fetch('/api/seed', { method: 'POST' });
                if(res.ok) alert('Database seeded with teachers!');
              }} size="sm" variant="secondary" className="w-full">
                🌱 Seed Database (Run Once)
              </Button>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-gray-500">POWERED BY</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <div className="mt-4 flex items-center justify-center gap-6 text-xs text-gray-500">
              <span className="flex items-center gap-1">✨ Gemini AI</span>
              <span className="flex items-center gap-1">🔥 Firebase</span>
              <span className="flex items-center gap-1">⚡ Next.js</span>
            </div>
          </div>
        ) : (
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-white text-center mb-2">Choose Your Role</h2>
            <p className="text-sm text-gray-400 text-center mb-8">This determines your experience in Doubtless</p>

            <div className="space-y-4">
              <button
                onClick={() => handleRoleSelect("student")}
                disabled={settingRole}
                className="w-full p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-blue-500/10 hover:border-blue-500/20 transition-all duration-300 text-left group disabled:opacity-50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
                    🎓
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Student</h3>
                    <p className="text-sm text-gray-400">Ask doubts, practice, get AI explanations</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleRoleSelect("teacher")}
                disabled={settingRole}
                className="w-full p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-all duration-300 text-left group disabled:opacity-50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-shadow">
                    👨‍🏫
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Teacher</h3>
                    <p className="text-sm text-gray-400">Help students, conduct live sessions</p>
                  </div>
                </div>
              </button>
            </div>

            {settingRole && (
              <div className="mt-6">
                <Loader size="sm" text="Setting up your account..." />
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-600 mt-8">
          The Industry Games 2026 · District 03: AI-Native Education
        </p>
      </div>
    </div>
  );
}
