"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  GraduationCap,
  Inbox,
  Loader2,
  Radio,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Star,
  Users,
  Video,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import FeedbackPanel from "@/components/teacher/FeedbackPanel";
import TeachingLevels from "@/components/teacher/TeachingLevels";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import Loader from "@/components/ui/Loader";
import { subscribeTeacher, subscribeTeacherApplication, subscribeTeacherSessions, updateSession, updateTeacher, updateUserProfile } from "@/lib/firestore";
import { cn } from "@/lib/utils";
import type { SessionRecord, TeacherApplication, TeacherProfile } from "@/types";

const STALE_MS = 3 * 60 * 1000;
const ago = (t: number) => formatDistanceToNow(t, { addSuffix: true });

export default function TeacherDashboard() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const isAdmin = useIsAdmin();

  const [app, setApp] = useState<TeacherApplication | null | undefined>(undefined);
  const [teacher, setTeacher] = useState<TeacherProfile | null | undefined>(undefined);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [toggling, setToggling] = useState(false);
  const seenPending = useRef<Set<string> | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Re-evaluate staleness as time passes, without needing new data.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);

  // Close sessions nobody is in any more so they stop showing as joinable.
  useEffect(() => {
    sessions
      .filter((s) => (s.status === "pending" || s.status === "active") && now - (s.lastActivityAt ?? s.createdAt) > STALE_MS)
      .forEach((s) => void updateSession(s.id, { status: "expired" }).catch(() => {}));
  }, [sessions, now]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return router.replace("/login");
    if (profile && profile.role !== "teacher") return router.replace("/dashboard");
    const unsubs = [
      subscribeTeacherApplication(user.uid, setApp),
      subscribeTeacher(user.uid, setTeacher),
      subscribeTeacherSessions(user.uid, (list) => {
        setSessions(list);
        // Announce requests that arrive while the dashboard is open.
        const pendingIds = list.filter((s) => s.status === "pending").map((s) => s.id);
        if (seenPending.current) {
          const fresh = pendingIds.filter((id) => !seenPending.current!.has(id));
          if (fresh.length) addToast(`New session request: ${list.find((s) => s.id === fresh[0])?.doubtContext.topic}`, "info");
        }
        seenPending.current = new Set(pendingIds);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user, profile, authLoading, router, addToast]);

  // Applications submitted before live-selfie profile photos existed still show the Google picture; switch them over.
  const selfie = app?.files.selfie;
  const teacherId = teacher?.id;
  const photoURL = teacher?.photoURL;
  useEffect(() => {
    if (!user || !selfie || !teacherId || photoURL?.startsWith("/api/teacher/photo")) return;
    const url = `/api/teacher/photo?uid=${encodeURIComponent(user.uid)}&v=${Date.now()}`;
    Promise.all([updateTeacher(teacherId, { photoURL: url }), updateUserProfile(user.uid, { photoURL: url })])
      .then(refreshProfile)
      .catch(() => {});
  }, [user, selfie, teacherId, photoURL, refreshProfile]);

  // Heartbeat: students only see you as online while this page is open and pinging.
  const tid = teacher?.id;
  const wantOnline = !!teacher?.availability;
  useEffect(() => {
    if (!tid || !wantOnline) return;
    const ping = () => void updateTeacher(tid, { lastSeenAt: Date.now() }).catch(() => {});
    ping();
    const t = setInterval(ping, 45_000);
    return () => clearInterval(t);
  }, [tid, wantOnline]);

  // Teachers without any registration go through onboarding first.
  useEffect(() => {
    if (app === null) router.replace("/teacher/onboarding");
  }, [app, router]);

  if (authLoading || app === undefined || teacher === undefined || !app) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  // A session is live only while someone has its page open (heartbeat every 30s). Otherwise it was abandoned.
  const isStale = (s: SessionRecord) => now - (s.lastActivityAt ?? s.createdAt) > STALE_MS;
  const pending = sessions.filter((s) => s.status === "pending" && !isStale(s));
  const active = sessions.filter((s) => s.status === "active" && !isStale(s));
  const past = sessions.filter((s) => s.status === "completed");
  const online = !!teacher?.availability;
  const firstName = (app.personal.fullName || profile?.displayName || "").split(" ")[0];

  const toggleAvailability = async () => {
    if (!teacher) return;
    setToggling(true);
    try {
      await updateTeacher(teacher.id, { availability: !online, ...(online ? {} : { lastSeenAt: Date.now() }) });
      addToast(online ? "You're offline. Students won't see you in matches." : "You're online. Students can now request sessions.", "success");
    } catch {
      addToast("Couldn't update your availability.", "error");
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar />
      <div className="lg:ml-64">
        <TopBar title="Dashboard" />
        <main id="main" className="mx-auto max-w-6xl space-y-6 p-4 pb-16 md:p-6">
          {/* Hero */}
          <section className="slide-up relative overflow-hidden rounded-card border border-line bg-sheet p-6 shadow-sheet md:p-8">
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
              <Avatar teacher={teacher} name={app.personal.fullName} verified={app.status === "approved"} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="display text-3xl text-ink">Welcome back, {firstName}.</h2>
                  <StatusPill status={app.status} />
                </div>
                <p className="mt-1 text-sm text-muted">{app.personal.headline}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {app.professional.subjects.map((s) => (
                    <span key={s} className="rounded-lg border border-line bg-sheet px-2.5 py-1 text-xs text-ink/80">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={toggleAvailability}
                role="switch"
                aria-checked={online}
                disabled={toggling || !teacher}
                className={cn(
                  "group flex items-center gap-3 self-start rounded-card border px-4 py-3 text-left transition-all md:self-center",
                  online ? "border-emerald-400/30 bg-emerald-400/10" : "border-line bg-sheet hover:border-line-strong"
                )}
              >
                <span className={cn("relative h-6 w-11 rounded-full transition-colors", online ? "bg-emerald-600" : "bg-ink/30")}>
                  <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-sheet shadow transition-all", online ? "left-[22px]" : "left-0.5")} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">{online ? "Online" : "Offline"}</span>
                  <span className="block text-xs text-muted">{online ? "Accepting requests" : "Go online to get matched"}</span>
                </span>
              </button>
            </div>
          </section>

          <VerificationCard app={app} />

          {teacher && (
            <section className="grid gap-4 lg:grid-cols-2">
              <FeedbackPanel teacher={teacher} />
              <TeachingLevels key={teacher.subjects.join("|")} teacher={teacher} />
            </section>
          )}

          {/* Stats */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={Inbox} label="Waiting now" value={pending.length} tone="blue" />
            <Stat icon={CheckCircle2} label="Sessions completed" value={past.length} tone="emerald" />
            <Stat icon={GraduationCap} label="Doubts resolved" value={teacher?.doubtsResolved ?? 0} tone="indigo" />
            <Stat icon={Star} label="Rating" value={teacher?.ratingCount ? teacher.rating.toFixed(1) : "New"} tone="amber" />
          </section>

          <div className="grid gap-6 lg:grid-cols-5">
            {/* Requests */}
            <section className="space-y-3 lg:col-span-3">
              <SectionTitle icon={Radio} title="Live requests" count={pending.length + active.length} live={pending.length > 0} />
              {pending.length + active.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title={online ? "Waiting for students" : "You're offline"}
                  body={online ? "New requests appear here instantly. Keep this tab open." : "Turn on availability above to start receiving session requests."}
                />
              ) : (
                [...active, ...pending].map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      "flex flex-col gap-4 rounded-card border p-4 sm:flex-row sm:items-center slide-up",
                      s.status === "active" ? "border-emerald-700/25 bg-emerald-600/[0.05]" : "border-pen/25 bg-pen-wash"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-ink">{s.doubtContext.topic}</p>
                        {s.doubtContext.subtopic && <span className="truncate text-sm text-faint">· {s.doubtContext.subtopic}</span>}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{s.doubtContext.reasoning}</p>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-faint">
                        <Clock className="h-3.5 w-3.5" />
                        {s.status === "active" ? "In progress" : `Requested ${ago(s.createdAt)}`}
                      </p>
                    </div>
                    <button
                      onClick={() => router.push(`/session/${s.id}`)}
                      className={cn(
                        "flex shrink-0 items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-semibold text-snow transition hover:brightness-110",
                        s.status === "active" ? "bg-emerald-600" : "bg-pen shadow-sheet"
                      )}
                    >
                      <Video className="h-4 w-4" /> {s.status === "active" ? "Rejoin" : "Accept & join"}
                    </button>
                  </div>
                ))
              )}
            </section>

            {/* Profile / shortcuts */}
            <aside className="space-y-3 lg:col-span-2">
              <SectionTitle icon={Users} title="Your profile" />
              <div className="rounded-card border border-line bg-sheet p-5">
                <p className="text-sm leading-6 text-ink/80 line-clamp-5">{app.personal.bio}</p>
                <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                  <Meta k="Qualification" v={`${app.professional.degree}, ${app.professional.institution}`} />
                  <Meta k="Experience" v={`${app.professional.experienceYears} years`} />
                  {app.professional.specialties.length > 0 && <Meta k="Specialties" v={app.professional.specialties.join(", ")} />}
                </dl>
                {app.status !== "approved" && (
                  <Link href="/teacher/onboarding" className="mt-4 inline-flex items-center gap-1.5 text-sm text-pen hover:text-pen-deep">
                    Edit registration <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
              {isAdmin && (
                <Link
                  href="/admin/teachers"
                  className="flex items-center justify-between rounded-card border border-pen/20 bg-pen/[0.06] p-4 text-sm text-pen-deep hover:bg-pen/10"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" /> Review teacher applications
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </aside>
          </div>

          {/* History */}
          <section className="space-y-3">
            <SectionTitle icon={Sparkles} title="Past sessions" count={past.length} />
            {past.length === 0 ? (
              <EmptyState icon={Sparkles} title="No sessions yet" body="When you end a session, Sθlvε writes an AI summary of what helped the student. It shows up here." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {past.slice(0, 12).map((s) => (
                  <div key={s.id} className="rounded-card border border-line bg-sheet p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-ink">{s.doubtContext.topic}</p>
                      <span className="shrink-0 text-xs text-faint">{ago(s.completedAt ?? s.createdAt)}</span>
                    </div>
                    {s.summary ? (
                      <div className="mt-3 space-y-2 text-sm">
                        <p className="text-muted">
                          <span className="text-faint">Root cause · </span>
                          {s.summary.root_cause}
                        </p>
                        <p className="text-muted">
                          <span className="text-faint">What worked · </span>
                          {s.summary.explanation_that_worked}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-faint">No summary recorded.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function Avatar({ teacher, name, verified }: { teacher: TeacherProfile | null; name: string; verified: boolean }) {
  return (
    <div className="relative h-20 w-20 shrink-0">
      {teacher?.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={teacher.photoURL} alt="" className="h-20 w-20 rounded-card object-cover ring-1 ring-ink/10" />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-card bg-ink font-display text-3xl font-semibold text-snow">
          {name.charAt(0) || "?"}
        </div>
      )}
      {verified && (
        <span className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-transparent">
          <BadgeCheck className="h-6 w-6 fill-pen text-sheet" />
        </span>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: TeacherApplication["status"] }) {
  const map = {
    approved: ["Verified", "border-pen/30 bg-pen/15 text-pen-deep"],
    pending: ["In review", "border-pen/30 bg-pen/15 text-pen-deep"],
    unverified: ["Unverified", "border-amber-700/25 bg-amber-500/15 text-amber-800"],
    rejected: ["Not approved", "border-margin/30 bg-margin/10 text-[#a82014]"],
  } as const;
  const [label, cls] = map[status];
  return <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", cls)}>{label}</span>;
}

function VerificationCard({ app }: { app: TeacherApplication }) {
  if (app.status === "approved") return null;
  const screening = app.screening;
  const config = {
    pending: {
      icon: Loader2,
      tone: "border-pen/25 bg-pen-wash",
      iconCls: "text-pen animate-spin [animation-duration:2.5s]",
      title: "Your verification is under review",
      body: "A reviewer is checking your documents against your live selfie and video. You can go online and take sessions while you wait.",
      cta: null,
    },
    unverified: {
      icon: ShieldAlert,
      tone: "border-amber-700/25 bg-amber-500/10",
      iconCls: "text-amber-800",
      title: "You're registered as unverified",
      body: "You signed up without a camera, so students see an “Unverified” label on your profile. Take a live selfie and record a short intro to get verified.",
      cta: "Complete live verification",
    },
    rejected: {
      icon: ShieldX,
      tone: "border-margin/30 bg-margin/[0.06]",
      iconCls: "text-margin",
      title: "Your verification wasn't approved",
      body: app.reviewNote ? `Reviewer note: ${app.reviewNote}` : "Please review your details and submit again.",
      cta: "Update and resubmit",
    },
  }[app.status];
  const Icon = config.icon;

  return (
    <section className={cn("flex flex-col gap-4 rounded-card border p-5 sm:flex-row sm:items-center", config.tone)}>
      <Icon className={cn("h-6 w-6 shrink-0", config.iconCls)} />
      <div className="flex-1">
        <p className="font-medium text-ink">{config.title}</p>
        <p className="mt-1 text-sm text-muted">{config.body}</p>
        {app.status === "pending" && (
          <ol className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            <li className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Submitted {ago(app.submittedAt)}
            </li>
            <li className={cn("flex items-center gap-1.5", screening?.status === "done" ? "text-emerald-700" : "")}>
              {screening?.status === "done" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {screening?.status === "done" ? "Automated checks complete" : screening?.status === "failed" ? "Automated checks unavailable" : "Running automated checks"}
            </li>
            <li className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Human review
            </li>
          </ol>
        )}
      </div>
      {config.cta && (
        <Link
          href="/teacher/onboarding"
          className="flex shrink-0 items-center justify-center gap-2 rounded-[10px] bg-ink px-4 py-2.5 text-sm font-medium text-snow transition-colors hover:bg-[#1f3159]"
        >
          {config.cta} <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </section>
  );
}

const TONES = {
  blue: "bg-pen/10 text-pen",
  emerald: "bg-emerald-600/10 text-emerald-700",
  indigo: "bg-ink/[0.07] text-ink",
  amber: "bg-amber-500/15 text-amber-800",
};

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Inbox; label: string; value: number | string; tone: keyof typeof TONES }) {
  return (
    <div className="rounded-card border border-line bg-sheet p-4 shadow-sheet">
      <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-lg", TONES[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="display tabular text-3xl text-ink">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, count, live }: { icon: typeof Inbox; title: string; count?: number; live?: boolean }) {
  return (
    <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
      <Icon className="h-4 w-4 text-pen" />
      {title}
      {count !== undefined && count > 0 && <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-xs text-muted">{count}</span>}
      {live && (
        <span className="relative ml-1 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pen opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-pen" />
        </span>
      )}
    </h3>
  );
}

function EmptyState({ icon: Icon, title, body }: { icon: typeof Inbox; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line px-6 py-10 text-center">
      <Icon className="mb-3 h-7 w-7 text-faint" />
      <p className="text-sm font-medium text-ink/80">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-faint">{body}</p>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-faint">{k}</dt>
      <dd className="min-w-0 text-ink/80">{v}</dd>
    </div>
  );
}
