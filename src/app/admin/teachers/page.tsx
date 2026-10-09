"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Inbox, Loader2, ShieldAlert, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { authedFetch, authedJSON } from "@/lib/apiClient";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import Loader from "@/components/ui/Loader";
import { cn } from "@/lib/utils";
import type { TeacherApplication } from "@/types";

const TABS = [
  { id: "pending", label: "Needs review" },
  { id: "unverified", label: "Unverified" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function AdminTeachersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const [apps, setApps] = useState<TeacherApplication[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [tab, setTab] = useState<Tab>("pending");
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(
    () =>
      authedJSON<{ applications: TeacherApplication[] }>("/api/admin/teachers")
        .then(({ applications }) => setApps(applications))
        .catch((err) => {
          if (err instanceof Error && /admins only/i.test(err.message)) setForbidden(true);
          else addToast(err instanceof Error ? err.message : "Couldn't load applications", "error");
          setApps([]);
        }),
    [addToast]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) return router.replace("/login");
    void load();
  }, [authLoading, user, router, load]);

  const visible = useMemo(() => (apps ?? []).filter((a) => a.status === tab), [apps, tab]);
  const current = apps?.find((a) => a.uid === selected) ?? visible[0] ?? null;

  if (authLoading || apps === null) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar />
      <div className="lg:ml-64">
        <TopBar title="Teacher Verification" />
        <main className="mx-auto max-w-7xl p-4 pb-16 md:p-6">
          {forbidden ? (
            <div className="mx-auto mt-16 max-w-md text-center">
              <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-rose-400" />
              <p className="text-lg font-semibold text-white">Admins only</p>
              <p className="mt-2 text-sm text-slate-400">Your account isn&apos;t listed in ADMIN_EMAILS, so it can&apos;t review teacher applications.</p>
            </div>
          ) : (
            <>
              <div className="mb-6 flex flex-wrap gap-2">
                {TABS.map((t) => {
                  const n = apps.filter((a) => a.status === t.id).length;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTab(t.id);
                        setSelected(null);
                      }}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm transition-colors",
                        tab === t.id ? "border-blue-400/30 bg-blue-500/10 text-white" : "border-white/[0.06] text-slate-400 hover:text-white"
                      )}
                    >
                      {t.label}
                      <span className="rounded-full bg-white/[0.08] px-1.5 text-xs tabular-nums">{n}</span>
                    </button>
                  );
                })}
              </div>

              {visible.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/[0.08] py-20 text-center">
                  <Inbox className="mb-3 h-8 w-8 text-slate-600" />
                  <p className="text-sm text-slate-400">Nothing here.</p>
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                  <ul className="space-y-2">
                    {visible.map((a) => (
                      <li key={a.uid}>
                        <button
                          onClick={() => setSelected(a.uid)}
                          className={cn(
                            "w-full rounded-2xl border p-4 text-left transition-colors",
                            current?.uid === a.uid ? "border-blue-400/30 bg-blue-500/[0.08]" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-medium text-white">{a.personal.fullName}</p>
                            <Recommendation app={a} />
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{a.professional.subjects.join(", ")}</p>
                          <p className="mt-2 text-xs text-slate-600">Submitted {formatDistanceToNow(a.submittedAt, { addSuffix: true })}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {current && <Detail key={current.uid} app={current} onReviewed={load} />}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Recommendation({ app }: { app: TeacherApplication }) {
  const s = app.screening;
  if (!s) return null;
  if (s.status === "running") return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-500" />;
  if (s.status === "failed" || !s.recommendation) return null;
  const cls = { approve: "text-emerald-300 bg-emerald-400/10", review: "text-amber-200 bg-amber-400/10", reject: "text-rose-300 bg-rose-500/10" }[s.recommendation];
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", cls)}>AI: {s.recommendation}</span>;
}

/** Loads a private verification file through an authenticated request. */
function useFileUrl(uid: string, file: string | undefined, key: string) {
  const [state, setState] = useState<{ url: string; type: string } | null>(null);
  useEffect(() => {
    if (!file) return;
    let url = "";
    let alive = true;
    authedFetch(`/api/teacher/application/file?uid=${encodeURIComponent(uid)}&file=${key}`)
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => {
        url = URL.createObjectURL(b);
        if (alive) setState({ url, type: b.type });
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [uid, file, key]);
  return state;
}

function Evidence({ app, k, label }: { app: TeacherApplication; k: keyof TeacherApplication["files"]; label: string }) {
  const f = useFileUrl(app.uid, app.files[k], k);
  return (
    <figure className="overflow-hidden rounded-2xl border border-white/[0.06] bg-black/30">
      <div className="relative flex aspect-video items-center justify-center bg-black">
        {!app.files[k] ? (
          <p className="text-xs text-slate-500">Not provided</p>
        ) : !f ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        ) : f.type.startsWith("video/") ? (
          <video src={f.url} controls className="h-full w-full object-contain" />
        ) : f.type.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.url} alt={label} className="h-full w-full object-contain" />
        ) : (
          <a href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-blue-300">
            <FileText className="h-5 w-5" /> Open PDF <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      <figcaption className="px-3 py-2 text-xs text-slate-400">{label}</figcaption>
    </figure>
  );
}

function Detail({ app, onReviewed }: { app: TeacherApplication; onReviewed: () => void }) {
  const { addToast } = useToast();
  const [note, setNote] = useState(app.reviewNote ?? "");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  const review = async (decision: "approve" | "reject") => {
    setBusy(decision);
    try {
      await authedJSON("/api/admin/teachers/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: app.uid, decision, note }),
      });
      addToast(decision === "approve" ? `${app.personal.fullName} is now verified.` : "Application rejected.", "success");
      onReviewed();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Review failed", "error");
    } finally {
      setBusy(null);
    }
  };

  const s = app.screening;
  return (
    <div className="space-y-5 rounded-3xl border border-white/[0.06] bg-[#fbf8f0]/80 p-5 md:p-6 slide-up">
      <div>
        <h2 className="text-xl font-semibold text-white">{app.personal.fullName}</h2>
        <p className="text-sm text-slate-400">{app.personal.headline}</p>
        <p className="mt-1 text-xs text-slate-500">
          {app.email} · {app.personal.phone}
          {app.personal.city && ` · ${app.personal.city}`}
        </p>
      </div>

      {app.liveness.skipped && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-sm text-amber-100">
          <ShieldAlert className="h-4 w-4" /> Registered without a camera. No live selfie or video to review.
        </p>
      )}

      {s && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
            <Sparkles className="h-4 w-4 text-indigo-300" /> AI pre-screening
            <Recommendation app={app} />
          </p>
          {s.status === "running" && <p className="text-sm text-slate-500">Running checks…</p>}
          {s.status === "failed" && <p className="text-sm text-rose-300">Screening failed: {s.error}</p>}
          {s.status === "done" && (
            <>
              {s.summary && <p className="mb-3 text-sm text-slate-400">{s.summary}</p>}
              <ul className="space-y-2">
                {s.checks?.map((c) => (
                  <li key={c.label} className="flex gap-2.5 text-sm">
                    {c.result === "pass" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    ) : c.result === "warn" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                    )}
                    <span>
                      <span className="text-slate-200">{c.label}</span>
                      <span className="text-slate-500"> · {c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Evidence app={app} k="selfie" label={`Live selfie${app.liveness.selfieChallenge ? ` · “${app.liveness.selfieChallenge}”` : ""}`} />
        <Evidence app={app} k="idDocument" label="Government ID" />
        <Evidence app={app} k="certificate" label="Qualification certificate" />
        <Evidence app={app} k="video" label={app.liveness.videoDurationSec ? `Video intro · ${app.liveness.videoDurationSec}s` : "Video intro"} />
      </div>
      {app.liveness.videoPrompt && <p className="text-xs text-slate-500">Video prompt: {app.liveness.videoPrompt}</p>}

      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <Info k="Qualification" v={`${app.professional.degree}, ${app.professional.institution}${app.professional.graduationYear ? ` (${app.professional.graduationYear})` : ""}`} />
        <Info k="Experience" v={`${app.professional.experienceYears} years${app.professional.currentRole ? ` · ${app.professional.currentRole}` : ""}`} />
        <Info k="Subjects" v={app.professional.subjects.join(", ")} />
        <Info k="Specialties" v={app.professional.specialties.join(", ") || "—"} />
        {app.professional.linkedinUrl && (
          <Info
            k="LinkedIn"
            v={
              <a href={app.professional.linkedinUrl} target="_blank" rel="noreferrer" className="text-blue-300 hover:underline">
                {app.professional.linkedinUrl}
              </a>
            }
          />
        )}
        <Info k="Bio" v={app.personal.bio} wide />
      </div>

      {app.status === "approved" || app.status === "rejected" ? (
        <p className="rounded-xl bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
          {app.status === "approved" ? "Approved" : "Rejected"} by {app.reviewedBy}
          {app.reviewedAt && ` ${formatDistanceToNow(app.reviewedAt, { addSuffix: true })}`}
          {app.reviewNote && ` · “${app.reviewNote}”`}
        </p>
      ) : (
        <div className="space-y-3 border-t border-white/[0.06] pt-5">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Note to the applicant (required when rejecting)"
            className="w-full resize-none"
          />
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => review("approve")}
              disabled={!!busy || !app.files.selfie}
              title={!app.files.selfie ? "Needs a live selfie before approval" : undefined}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-snow hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Approve & verify
            </button>
            <button
              onClick={() => review("reject")}
              disabled={!!busy}
              className="flex items-center gap-2 rounded-xl border border-rose-400/30 px-5 py-2.5 text-sm font-semibold text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"
            >
              {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ k, v, wide }: { k: string; v: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn(wide && "sm:col-span-2")}>
      <p className="text-xs text-slate-500">{k}</p>
      <p className="mt-0.5 break-words text-slate-300">{v}</p>
    </div>
  );
}
