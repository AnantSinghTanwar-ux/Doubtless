"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import type { UserRole } from "@/types";
import Loader from "@/components/ui/Loader";
import Link from "next/link";
import { ArrowLeft, Brain, GraduationCap, ShieldCheck, Video } from "lucide-react";
import Logo from "@/components/landing/Logo";
import { authedJSON } from "@/lib/apiClient";

export default function LoginPage() {
  const { user, profile, loading, signInWithGoogle, signInWithEmail, logout, setRole } = useAuth();
  const router = useRouter();
  const [choosingRole, setChoosingRole] = useState(false);
  const [settingRole, setSettingRole] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user && profile) {
      router.replace(profile.role === "teacher" ? "/teacher-dashboard" : "/dashboard");
    } else if (user && !profile) {
      // Admins have no student/teacher profile; send them straight to the review console.
      authedJSON<{ isAdmin: boolean }>("/api/admin/me")
        .then((r) => (r.isAdmin ? router.replace("/admin/teachers") : setChoosingRole(true)))
        .catch(() => setChoosingRole(true));
    }
  }, [user, profile, loading, router]);

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminBusy(true);
    setAdminError("");
    try {
      await signInWithEmail(adminEmail, adminPassword);
      const { isAdmin } = await authedJSON<{ isAdmin: boolean }>("/api/admin/me");
      if (!isAdmin) {
        await logout();
        setAdminError("This account does not have admin access.");
      }
    } catch {
      setAdminError("Incorrect email or password.");
    } finally {
      setAdminBusy(false);
    }
  };

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
      router.replace(role === "teacher" ? "/teacher/onboarding" : "/dashboard");
    } catch (error) {
      console.error("Role selection failed:", error);
      setSettingRole(false);
    }
  };

  // Signed in without a profile and not yet routed: we are checking whether this is an admin.
  if (loading || (user && !profile && !choosingRole)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  const googleIcon = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );

  const perks = [
    { icon: Brain, title: "Diagnoses why you're stuck", body: "Then routes you to AI, practice or a teacher." },
    { icon: Video, title: "Live video with teachers", body: "One-to-one, right in your browser." },
    { icon: ShieldCheck, title: "Verified teachers", body: "ID and live-selfie checked before the badge." },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Link href="/" className="lp-drop absolute left-5 top-5 z-20 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink sm:left-8 sm:top-7">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to home
      </Link>

      <main id="main" className="relative z-10 mx-auto grid min-h-screen max-w-6xl items-center gap-16 px-6 py-24 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="lp-rise hidden lg:block">
          <div className="mb-8 flex items-center gap-3">
            <Logo size={44} />
            <span className="font-display text-3xl font-semibold tracking-tight text-ink">ωlvε</span>
          </div>
          <h1 className="display text-5xl text-ink">Get unstuck, fast.</h1>
          <p className="mt-5 max-w-md text-lg leading-8 text-muted">The AI-native education OS that finds the real reason you&apos;re stuck and sends you to the fastest help.</p>
          <ul className="mt-10 space-y-5">
            {perks.map((p, i) => (
              <li key={p.title} className="lp-rise flex items-start gap-4" style={{ animationDelay: `${0.25 + i * 0.12}s` }}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pen/10 text-pen">
                  <p.icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="font-medium text-ink">{p.title}</p>
                  <p className="text-sm text-muted">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="lp-rise mx-auto w-full max-w-md" style={{ animationDelay: "0.15s" }}>
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <Logo size={52} />
            <p className="mt-4 font-display text-3xl font-semibold text-ink">ωlvε</p>
          </div>

          <div className="rounded-card border border-line bg-sheet p-7 shadow-lift sm:p-8">
            {choosingRole ? (
              <div className="slide-up">
                <h1 className="text-center font-display text-2xl font-semibold text-ink">How will you use ωlvε?</h1>
                <p className="mb-7 mt-2 text-center text-sm text-muted">Pick the one that fits you.</p>
                <div className="space-y-3">
                  {[
                    { role: "student" as UserRole, icon: GraduationCap, title: "I'm a student", body: "Ask doubts, practise and learn with AI" },
                    { role: "teacher" as UserRole, icon: Video, title: "I'm a teacher", body: "Register, get verified and teach live" },
                  ].map((o) => (
                    <button
                      key={o.role}
                      onClick={() => handleRoleSelect(o.role)}
                      disabled={settingRole}
                      className="group flex w-full items-center gap-4 rounded-xl border border-line-strong bg-sheet p-4 text-left transition-[border-color,background-color] duration-150 hover:border-pen hover:bg-pen-wash disabled:opacity-50"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink text-snow">
                        <o.icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span>
                        <span className="block font-semibold text-ink">{o.title}</span>
                        <span className="block text-sm text-muted">{o.body}</span>
                      </span>
                    </button>
                  ))}
                </div>
                {settingRole && (
                  <div className="mt-6">
                    <Loader size="sm" text="Setting up your account..." />
                  </div>
                )}
              </div>
            ) : adminMode ? (
              <form onSubmit={handleAdminSignIn} className="slide-up space-y-4">
                <h1 className="text-center font-display text-2xl font-semibold text-ink">Admin sign in</h1>
                <input type="email" required autoComplete="username" aria-label="Admin email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="Admin email" className="w-full" />
                <input type="password" required autoComplete="current-password" aria-label="Password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Password" className="w-full" />
                {adminError && (
                  <p role="alert" className="text-sm text-margin">
                    {adminError}
                  </p>
                )}
                <Button type="submit" size="lg" className="w-full" loading={adminBusy}>
                  Sign in
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setAdminMode(false);
                    setAdminError("");
                  }}
                  className="w-full text-sm text-muted transition-colors hover:text-ink"
                >
                  Back to student / teacher sign in
                </button>
              </form>
            ) : (
              <div className="slide-up">
                <h1 className="text-center font-display text-2xl font-semibold text-ink">Welcome to ωlvε</h1>
                <p className="mb-7 mt-2 text-center text-sm text-muted">Sign in or create your account in one click.</p>
                <Button onClick={handleSignIn} size="lg" className="w-full">
                  {googleIcon}
                  Continue with Google
                </Button>
                <button onClick={() => setAdminMode(true)} className="mt-5 w-full text-sm text-muted transition-colors hover:text-ink">
                  Admin? Sign in with email
                </button>
              </div>
            )}
          </div>

          <p className="mt-8 text-center text-xs text-faint">The Industry Games 2026, District 03</p>
        </div>
      </main>
    </div>
  );
}
