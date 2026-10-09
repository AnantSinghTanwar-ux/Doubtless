"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dumbbell, MessageSquare, PenTool, Users } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";
import Loader from "@/components/ui/Loader";
import WeakTopics from "@/components/dashboard/WeakTopics";
import Card from "@/components/ui/Card";
import { getLearnerProfile } from "@/lib/firestore";
import type { LearnerProfile } from "@/types";

const tools = [
  { href: "/ask", label: "Ask a doubt", body: "Get routed to the fastest help", icon: MessageSquare },
  { href: "/solve", label: "Check my working", body: "Find the first wrong step", icon: PenTool },
  { href: "/practice", label: "Practise", body: "Questions aimed at your gaps", icon: Dumbbell },
  { href: "/teachers", label: "Talk to a teacher", body: "Live video with verified people", icon: Users },
];

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
      <div className="flex min-h-screen items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (!learnerProfile) return null;

  const first = authProfile?.displayName?.split(" ")[0];
  const total = learnerProfile.totalDoubtsResolved;
  const split = [
    { label: "AI explanations", value: learnerProfile.aiResolved, bar: "bg-ink" },
    { label: "Practice", value: learnerProfile.practiceResolved, bar: "bg-pen" },
    { label: "Teachers", value: learnerProfile.teacherResolved, bar: "bg-margin" },
  ];

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar />
      <div className="lg:ml-64">
        <TopBar title="Dashboard" />
        <main id="main" className="mx-auto max-w-6xl space-y-6 p-4 pb-24 md:p-6 md:pb-24 lg:pb-8">
          <section>
            <h2 className="display text-3xl text-ink sm:text-4xl">Welcome back{first ? `, ${first}` : ""}.</h2>
            <p className="mt-2 text-muted">Pick up where you left off, or ask something new.</p>
          </section>

          <section aria-label="Quick actions" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tools.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="group flex items-start gap-3 rounded-card border border-line bg-sheet p-4 shadow-sheet transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-pen/50 hover:shadow-lift"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pen/10 text-pen transition-colors group-hover:bg-pen group-hover:text-snow">
                  <t.icon className="h-5 w-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-medium text-ink">{t.label}</span>
                  <span className="block text-sm text-muted">{t.body}</span>
                </span>
              </Link>
            ))}
          </section>

          <Card>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted">Doubts resolved</p>
                <p className="display tabular mt-1 text-6xl text-ink">{total}</p>
              </div>
              <p className="max-w-xs text-sm text-muted">
                {total === 0 ? "Ask your first doubt and it will show up here." : "How your doubts got sorted out, by type of help."}
              </p>
            </div>
            <div className="mt-6 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-ink/10" role="img" aria-label={split.map((x) => `${x.label}: ${x.value}`).join(", ")}>
              {total > 0 && split.map((x) => <div key={x.label} className={x.bar} style={{ width: `${(x.value / total) * 100}%` }} />)}
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-4">
              {split.map((x) => (
                <div key={x.label}>
                  <dt className="flex items-center gap-2 text-sm text-muted">
                    <span className={`h-2.5 w-2.5 rounded-sm ${x.bar}`} aria-hidden />
                    {x.label}
                  </dt>
                  <dd className="display tabular mt-1 text-3xl text-ink">{x.value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <WeakTopics profile={learnerProfile} />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
