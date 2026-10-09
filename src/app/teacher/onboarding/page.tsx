"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Check,
  FileCheck2,
  GraduationCap,
  Lock,
  ScanFace,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { getTeacherApplication } from "@/lib/firestore";
import { authedJSON } from "@/lib/apiClient";
import { chunkCount, uploadMedia } from "@/lib/mediaStore";
import { compressImage } from "@/lib/imageUtils";
import { dataUrlToBlob, type CameraStatus } from "@/hooks/useCamera";
import LiveSelfie, { type SelfieResult } from "@/components/teacher/LiveSelfie";
import VideoIntro, { type VideoResult } from "@/components/teacher/VideoIntro";
import DocumentDrop from "@/components/teacher/DocumentDrop";
import Logo from "@/components/landing/Logo";
import Loader from "@/components/ui/Loader";
import { cn } from "@/lib/utils";
import type { TeacherApplication } from "@/types";

const STEPS = [
  { id: "about", label: "About you", icon: UserRound },
  { id: "expertise", label: "Expertise", icon: GraduationCap },
  { id: "documents", label: "Documents", icon: FileCheck2 },
  { id: "selfie", label: "Live selfie", icon: ScanFace },
  { id: "video", label: "Video intro", icon: Video },
  { id: "review", label: "Review & submit", icon: BadgeCheck },
] as const;
type StepId = (typeof STEPS)[number]["id"];

const SUBJECT_SUGGESTIONS = ["Mathematics", "Physics", "Chemistry", "Biology", "Computer Science", "English", "Economics", "Accountancy"];

const emptyForm = {
  fullName: "",
  phone: "",
  city: "",
  headline: "",
  bio: "",
  degree: "",
  institution: "",
  graduationYear: "",
  experienceYears: "",
  currentRole: "",
  linkedinUrl: "",
  subjects: [] as string[],
  specialties: [] as string[],
};
type Form = typeof emptyForm;

function validate(step: StepId, f: Form, docs: { id: boolean; cert: boolean }): string[] {
  switch (step) {
    case "about":
      return [
        !f.fullName.trim() && "Enter your full legal name.",
        !/^[+\d][\d\s-]{7,}$/.test(f.phone.trim()) && "Enter a valid phone number.",
        !f.headline.trim() && "Add a one-line headline.",
        f.bio.trim().length < 80 && `Your bio needs ${80 - f.bio.trim().length} more characters.`,
      ].filter(Boolean) as string[];
    case "expertise":
      return [
        !f.degree.trim() && "Enter your highest qualification.",
        !f.institution.trim() && "Enter the institution.",
        f.subjects.length === 0 && "Add at least one subject you teach.",
        f.linkedinUrl && !/^https?:\/\//.test(f.linkedinUrl) && "LinkedIn URL must start with https://",
      ].filter(Boolean) as string[];
    case "documents":
      return [!docs.id && "Upload a government ID.", !docs.cert && "Upload a qualification certificate."].filter(Boolean) as string[];
    default:
      return [];
  }
}

export default function TeacherOnboarding() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();

  const [existing, setExisting] = useState<TeacherApplication | null>(null);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<StepId>("about");
  const [maxReached, setMaxReached] = useState(0);
  const [form, setForm] = useState<Form>(emptyForm);
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [certificate, setCertificate] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<SelfieResult | null>(null);
  const [video, setVideo] = useState<VideoResult | null>(null);
  const [skipLive, setSkipLive] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) return router.replace("/login");
    if (profile && profile.role !== "teacher") return router.replace("/dashboard");
    getTeacherApplication(user.uid)
      .then((app) => {
        if (app?.status === "approved") return router.replace("/teacher-dashboard");
        if (app) {
          setExisting(app);
          const p = app.personal;
          const q = app.professional;
          setForm({
            ...p,
            degree: q.degree,
            institution: q.institution,
            graduationYear: q.graduationYear ? String(q.graduationYear) : "",
            experienceYears: String(q.experienceYears ?? ""),
            currentRole: q.currentRole,
            linkedinUrl: q.linkedinUrl,
            subjects: q.subjects,
            specialties: q.specialties,
          });
          // Returning applicants already gave their details; take them straight to the live checks.
          setStep("selfie");
          setMaxReached(STEPS.length - 1);
        } else {
          setForm((f) => ({ ...f, fullName: user.displayName || "" }));
        }
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [user, profile, loading, router]);

  const idx = STEPS.findIndex((s) => s.id === step);
  const docs = { id: !!idDocument || !!existing?.files.idDocument, cert: !!certificate || !!existing?.files.certificate };
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const onCameraStatus = useCallback((s: CameraStatus) => setCameraStatus(s), []);
  const cameraBlocked = cameraStatus === "denied" || cameraStatus === "unavailable";

  const goto = (target: number) => {
    setErrors([]);
    setStep(STEPS[target].id);
    setMaxReached((m) => Math.max(m, target));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => {
    const problems = validate(step, form, docs);
    if (step === "selfie" && !selfie) problems.push("Capture a live selfie to continue.");
    if (step === "video" && !video) problems.push("Record your video introduction to continue.");
    if (problems.length) return setErrors(problems);
    if (step === "selfie" || step === "video") setSkipLive(false);
    goto(idx + 1);
  };

  const continueUnverified = () => {
    setSkipLive(true);
    setSelfie(null);
    setVideo(null);
    goto(STEPS.length - 1);
  };

  const submit = async () => {
    for (const s of STEPS.slice(0, 3)) {
      const problems = validate(s.id, form, docs);
      if (problems.length) {
        setStep(s.id);
        return setErrors(problems);
      }
    }
    if (!skipLive && (!selfie || !video)) return setErrors(["Complete the live selfie and video, or continue as unverified."]);
    if (!consent) return setErrors(["Please confirm the declaration to submit."]);

    setSubmitting(true);
    setErrors([]);
    try {
      // Files go straight from the browser to storage (in pieces); the API call below only carries the details.
      const uploads: { key: string; blob: Blob }[] = [];
      if (idDocument) uploads.push({ key: "idDocument", blob: await compressImage(idDocument) });
      if (certificate) uploads.push({ key: "certificate", blob: await compressImage(certificate) });
      if (!skipLive) {
        uploads.push({ key: "selfie", blob: dataUrlToBlob(selfie!.dataUrl) });
        uploads.push({ key: "video", blob: video!.blob });
      }
      const totalChunks = uploads.reduce((n, u) => n + chunkCount(u.blob.size), 0);
      let done = 0;
      setUploadPct(0);
      for (const u of uploads) {
        await uploadMedia(user!.uid, u.key, u.blob, () => setUploadPct(Math.round((++done / totalChunks) * 100)));
      }

      const body = JSON.stringify({
        details: {
          personal: { fullName: form.fullName, phone: form.phone, city: form.city, headline: form.headline, bio: form.bio },
          professional: {
            degree: form.degree,
            institution: form.institution,
            graduationYear: Number(form.graduationYear) || 0,
            experienceYears: Number(form.experienceYears) || 0,
            currentRole: form.currentRole,
            linkedinUrl: form.linkedinUrl,
            subjects: form.subjects,
            specialties: form.specialties,
          },
          liveness: skipLive
            ? { skipped: true }
            : {
                selfieChallenge: selfie!.challenge,
                selfieCapturedAt: selfie!.capturedAt,
                videoPrompt: video!.prompt,
                videoDurationSec: video!.durationSec,
              },
        },
        videoFrames: skipLive ? [] : video!.frames,
      });
      await authedJSON("/api/teacher/application", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      addToast(skipLive ? "Registered. Complete live verification any time to get verified." : "Application submitted for review.", "success");
      await refreshProfile();
      router.replace("/teacher-dashboard");
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Submission failed. Please try again."]);
      setSubmitting(false);
    }
  };

  if (loading || !ready) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (existing?.status === "pending" && !editing) {
    return (
      <div className="min-h-screen bg-transparent text-ink flex items-center justify-center px-4">
        <div className="max-w-md rounded-card border border-line bg-sheet p-8 text-center shadow-lift slide-up">
          <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-pen" />
          <h1 className="font-display text-2xl font-semibold">Your application is under review</h1>
          <p className="mt-2 text-sm text-muted">
            A reviewer is checking your documents against your live selfie and video. You can use your dashboard in the meantime.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link href="/teacher-dashboard" className="rounded-[10px] bg-pen px-5 py-3 text-sm font-semibold text-snow">
              Go to dashboard
            </Link>
            <button onClick={() => setEditing(true)} className="text-sm text-muted hover:text-ink">
              Edit and resubmit instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-ink">
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 lg:flex-row lg:px-8 lg:py-12">
        {/* Step rail */}
        <aside className="lg:sticky lg:top-12 lg:h-fit lg:w-72 shrink-0">
          <Link href="/teacher-dashboard" className="mb-8 flex items-center gap-3">
            <Logo size={40} />
            <div>
              <p className="font-display text-lg font-semibold leading-tight tracking-tight">Sθlvε</p>
              <p className="text-xs text-muted">Teacher registration</p>
            </div>
          </Link>

          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-ink/5 lg:hidden">
            <div className="h-full rounded-full bg-pen transition-all duration-500" style={{ width: `${((idx + 1) / STEPS.length) * 100}%` }} />
          </div>
          <p className="mb-4 text-xs text-faint lg:hidden">
            Step {idx + 1} of {STEPS.length} · {STEPS[idx].label}
          </p>

          <ol className="hidden space-y-1 lg:block">
            {STEPS.map((s, i) => {
              const done = i !== idx && i < maxReached;
              const skippedLive = skipLive && (s.id === "selfie" || s.id === "video");
              return (
                <li key={s.id}>
                  <button
                    onClick={() => i <= maxReached && goto(i)}
                    disabled={i > maxReached}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                      i === idx ? "bg-ink/[0.06] text-ink" : "text-muted hover:text-ink disabled:hover:text-muted",
                      i > maxReached && "opacity-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
                        i === idx
                          ? "border-pen/40 bg-pen/15 text-pen"
                          : skippedLive
                            ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                            : done
                              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                              : "border-line bg-sheet"
                      )}
                    >
                      {skippedLive ? <X className="h-4 w-4" /> : done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                    </span>
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="mt-8 hidden rounded-card border border-line bg-sheet p-4 text-xs leading-5 text-muted lg:block">
            <p className="mb-2 flex items-center gap-2 font-medium text-ink">
              <Lock className="h-3.5 w-3.5 text-emerald-400" /> Why we verify
            </p>
            Students meet you live on video. A live selfie, a recorded intro and your documents let us confirm you are who you say you are. Your
            documents are stored privately and only reviewers can see them.
          </div>
        </aside>

        {/* Step content */}
        <main id="main" className="min-w-0 flex-1">
          {existing && step !== "review" && (
            <div
              className={cn(
                "mb-6 flex items-start gap-3 rounded-card border p-4 text-sm",
                existing.status === "rejected" ? "border-rose-400/20 bg-rose-500/[0.06] text-rose-100" : "border-amber-400/20 bg-amber-400/[0.06] text-amber-100"
              )}
            >
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                {existing.status === "rejected" ? (
                  <>
                    <p className="font-medium">Your previous application was not approved.</p>
                    {existing.reviewNote && <p className="mt-1 opacity-80">Reviewer note: {existing.reviewNote}</p>}
                  </>
                ) : existing.status === "unverified" ? (
                  <p>You registered without camera checks. Complete the live selfie and video below to get your verified badge.</p>
                ) : (
                  <p>You already have an application under review. Submitting again replaces it.</p>
                )}
                <p className="mt-1 opacity-70">Your saved details are filled in. Earlier steps are editable from the left.</p>
              </div>
            </div>
          )}

          <div key={step} className="rounded-card border border-line bg-sheet p-6 shadow-lift sm:p-8 slide-up">
            <StepHeader idx={idx} />

            {step === "about" && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full legal name" hint="As it appears on your ID">
                  <input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Priya Sharma" className="w-full" />
                </Field>
                <Field label="Phone number">
                  <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" inputMode="tel" className="w-full" />
                </Field>
                <Field label="City" optional>
                  <input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Bengaluru" className="w-full" />
                </Field>
                <Field label="Headline" hint="Shown under your name to students">
                  <input
                    value={form.headline}
                    onChange={(e) => set("headline", e.target.value)}
                    placeholder="IIT-trained physics tutor · 8 yrs JEE coaching"
                    maxLength={120}
                    className="w-full"
                  />
                </Field>
                <Field label="Bio" hint="How you teach, who you've taught, what students can expect" className="sm:col-span-2">
                  <textarea
                    value={form.bio}
                    onChange={(e) => set("bio", e.target.value)}
                    rows={5}
                    maxLength={1500}
                    placeholder="I break down hard ideas with everyday examples…"
                    className="w-full resize-none"
                  />
                  <p className={cn("mt-1.5 text-right text-xs", form.bio.trim().length >= 80 ? "text-emerald-400" : "text-faint")}>
                    {form.bio.trim().length} / 80 minimum
                  </p>
                </Field>
              </div>
            )}

            {step === "expertise" && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Highest qualification">
                  <input value={form.degree} onChange={(e) => set("degree", e.target.value)} placeholder="M.Sc. Physics" className="w-full" />
                </Field>
                <Field label="Institution">
                  <input value={form.institution} onChange={(e) => set("institution", e.target.value)} placeholder="IIT Delhi" className="w-full" />
                </Field>
                <Field label="Graduation year" optional>
                  <input
                    value={form.graduationYear}
                    onChange={(e) => set("graduationYear", e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="2016"
                    inputMode="numeric"
                    className="w-full"
                  />
                </Field>
                <Field label="Years of teaching experience">
                  <input
                    value={form.experienceYears}
                    onChange={(e) => set("experienceYears", e.target.value.replace(/\D/g, "").slice(0, 2))}
                    placeholder="5"
                    inputMode="numeric"
                    className="w-full"
                  />
                </Field>
                <Field label="Current role" optional>
                  <input value={form.currentRole} onChange={(e) => set("currentRole", e.target.value)} placeholder="Senior faculty, XYZ Academy" className="w-full" />
                </Field>
                <Field label="LinkedIn profile" optional>
                  <input value={form.linkedinUrl} onChange={(e) => set("linkedinUrl", e.target.value)} placeholder="https://linkedin.com/in/…" className="w-full" />
                </Field>
                <Field label="Subjects you teach" className="sm:col-span-2">
                  <TagInput value={form.subjects} onChange={(v) => set("subjects", v)} placeholder="Type a subject and press Enter" suggestions={SUBJECT_SUGGESTIONS} />
                </Field>
                <Field label="Specialties" hint="Topics you're strongest at, e.g. Rotational Dynamics" optional className="sm:col-span-2">
                  <TagInput value={form.specialties} onChange={(v) => set("specialties", v)} placeholder="Type a topic and press Enter" />
                </Field>
              </div>
            )}

            {step === "documents" && (
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <DocumentDrop label="Government ID" hint="Aadhaar, PAN, passport or driving licence. Name must match your profile." value={idDocument} onChange={setIdDocument} />
                  {!idDocument && existing?.files.idDocument && <PreviouslyUploaded />}
                </div>
                <div>
                  <DocumentDrop label="Qualification certificate" hint="Degree, diploma or teaching certificate." value={certificate} onChange={setCertificate} />
                  {!certificate && existing?.files.certificate && <PreviouslyUploaded />}
                </div>
              </div>
            )}

            {step === "selfie" && (
              <>
                <LiveSelfie value={selfie} onChange={(v) => { setSelfie(v); if (v) setErrors([]); }} onCameraStatus={onCameraStatus} />
                <p className="mt-4 text-xs text-faint">Photos can only be taken live with your camera. Uploading an existing image isn&apos;t possible.</p>
                {cameraBlocked && <NoCameraCard onContinue={continueUnverified} />}
              </>
            )}

            {step === "video" && (
              <>
                <VideoIntro subject={form.subjects[0] || ""} value={video} onChange={(v) => { setVideo(v); if (v) setErrors([]); }} onCameraStatus={onCameraStatus} />
                {cameraBlocked && <NoCameraCard onContinue={continueUnverified} />}
              </>
            )}

            {step === "review" && (
              <div className="space-y-6">
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-card border p-4",
                    skipLive ? "border-amber-400/25 bg-amber-400/[0.06]" : "border-emerald-400/25 bg-emerald-400/[0.06]"
                  )}
                >
                  {skipLive ? <ShieldAlert className="h-5 w-5 shrink-0 text-amber-300" /> : <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-300" />}
                  <div className="text-sm">
                    <p className={cn("font-medium", skipLive ? "text-amber-100" : "text-emerald-100")}>
                      {skipLive ? "You'll be registered as an unverified teacher" : "Ready for verification"}
                    </p>
                    <p className="mt-1 text-muted">
                      {skipLive
                        ? "Without a live selfie and video we can't verify your identity. Students will see an “Unverified” label until you complete live verification from your dashboard."
                        : "A reviewer will check your documents against your live selfie and video, usually within 24 hours. You can set up your dashboard meanwhile."}
                    </p>
                    {skipLive && (
                      <button onClick={() => goto(3)} className="mt-2 text-sm font-medium text-amber-200 underline-offset-4 hover:underline">
                        Try the camera again
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Summary title="About you" onEdit={() => goto(0)}>
                    <Row k="Name" v={form.fullName} />
                    <Row k="Phone" v={form.phone} />
                    {form.city && <Row k="City" v={form.city} />}
                    <Row k="Headline" v={form.headline} />
                  </Summary>
                  <Summary title="Expertise" onEdit={() => goto(1)}>
                    <Row k="Qualification" v={`${form.degree}, ${form.institution}`} />
                    <Row k="Experience" v={`${form.experienceYears || 0} years`} />
                    <Row k="Subjects" v={form.subjects.join(", ")} />
                    {form.specialties.length > 0 && <Row k="Specialties" v={form.specialties.join(", ")} />}
                  </Summary>
                  <Summary title="Documents" onEdit={() => goto(2)}>
                    <Row k="Government ID" v={idDocument?.name || (existing?.files.idDocument ? "Previously uploaded" : "—")} />
                    <Row k="Certificate" v={certificate?.name || (existing?.files.certificate ? "Previously uploaded" : "—")} />
                  </Summary>
                  <Summary title="Live checks" onEdit={() => goto(3)}>
                    {skipLive ? (
                      <p className="text-sm text-amber-200">Skipped: no camera available</p>
                    ) : (
                      <div className="flex items-center gap-3">
                        {selfie && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={selfie.dataUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />
                        )}
                        <div className="text-sm text-ink/80">
                          <p>Selfie captured live</p>
                          <p className="text-faint">{video?.durationSec}s video introduction</p>
                        </div>
                      </div>
                    )}
                  </Summary>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-card border border-line bg-sheet p-4 text-sm text-ink/80">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-pen p-0" />
                  I confirm these details and documents are genuine and belong to me, and I consent to Sθlvε reviewing them to verify my identity.
                </label>
              </div>
            )}

            {errors.length > 0 && (
              <ul className="mt-6 space-y-1 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-200">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}

            <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-6">
              <button
                onClick={() => (idx === 0 ? router.push("/teacher-dashboard") : goto(skipLive && step === "review" ? 2 : idx - 1))}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-muted hover:bg-ink/5 hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" /> {idx === 0 ? "Cancel" : "Back"}
              </button>
              {step === "review" ? (
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-[10px] bg-pen px-6 py-3 text-sm font-semibold text-snow shadow-sheet transition hover:brightness-110 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-white" /> {uploadPct < 100 ? `Uploading securely… ${uploadPct}%` : "Finishing up…"}
                    </>
                  ) : (
                    <>
                      {skipLive ? "Register as unverified" : "Submit for verification"} <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={next}
                  className="flex items-center gap-2 rounded-[10px] bg-pen px-6 py-3 text-sm font-semibold text-snow shadow-sheet transition hover:brightness-110"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

const STEP_COPY: Record<StepId, { title: string; body: string }> = {
  about: { title: "Tell students who you are", body: "This is the profile students see before they book a live session with you." },
  expertise: { title: "Your teaching expertise", body: "We match students to you based on these subjects and specialties." },
  documents: { title: "Upload your documents", body: "Kept private. Only verification reviewers can open them." },
  selfie: { title: "Take a live selfie", body: "Turn on your camera, do the on-screen gesture and we'll snap a photo. This proves you're a real, present person." },
  video: { title: "Record a short introduction", body: "A 20–90 second clip in your own voice. Reviewers use it to match you with your selfie and ID." },
  review: { title: "Review and submit", body: "Check everything below. You can edit any section before submitting." },
};

function StepHeader({ idx }: { idx: number }) {
  const s = STEPS[idx];
  return (
    <div className="mb-8 flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-pen/20 ring-1 ring-pen/20">
        <s.icon className="h-5 w-5 text-pen" />
      </div>
      <div>
        <p className="text-xs font-medium text-pen/80">
          Step {idx + 1} of {STEPS.length}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{STEP_COPY[s.id].title}</h1>
        <p className="mt-1 text-sm text-muted">{STEP_COPY[s.id].body}</p>
      </div>
    </div>
  );
}

function Field({ label, hint, optional, className, children }: { label: string; hint?: string; optional?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-baseline gap-2 text-sm font-medium text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-faint">Optional</span>}
      </span>
      {hint && <span className="mb-2 block text-xs text-faint">{hint}</span>}
      {children}
    </label>
  );
}

function TagInput({ value, onChange, placeholder, suggestions = [] }: { value: string[]; onChange: (v: string[]) => void; placeholder: string; suggestions?: string[] }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const t = raw.trim().replace(/,$/, "");
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase()) && value.length < 12) onChange([...value, t]);
    setDraft("");
  };
  const remaining = useMemo(() => suggestions.filter((s) => !value.includes(s)), [suggestions, value]);
  return (
    <div>
      <div className="flex min-h-[46px] flex-wrap items-center gap-2 rounded-xl border border-line bg-sheet px-2 py-1.5 focus-within:border-pen/50 focus-within:ring-[3px] focus-within:ring-pen/10">
        {value.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded-lg bg-pen/15 py-1 pl-2.5 pr-1 text-sm text-pen-deep">
            {t}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== t))} className="rounded p-0.5 hover:bg-ink/10" aria-label={`Remove ${t}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[160px] flex-1 border-0 bg-transparent px-1 py-1 shadow-none focus:shadow-none"
        />
      </div>
      {remaining.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {remaining.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:border-pen/30 hover:text-pen-deep">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NoCameraCard({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="mt-5 rounded-card border border-amber-400/20 bg-amber-400/[0.05] p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-amber-100">
        <ShieldAlert className="h-4 w-4" /> No camera available?
      </p>
      <p className="mt-1 text-sm text-muted">
        You can still register and teach, but your profile will show <span className="text-amber-200">Unverified</span> to students until you complete live
        verification from a device with a camera.
      </p>
      <button onClick={onContinue} className="mt-3 rounded-lg border border-amber-400/30 px-3.5 py-2 text-sm font-medium text-amber-100 hover:bg-amber-400/10">
        Continue as unverified
      </button>
    </div>
  );
}

function PreviouslyUploaded() {
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-300">
      <Check className="h-3.5 w-3.5" /> Previously uploaded. Upload again only to replace it.
    </p>
  );
}

function Summary({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-sheet p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          <BookOpen className="h-4 w-4 text-faint" /> {title}
        </p>
        <button onClick={onEdit} className="text-xs text-pen hover:text-pen-deep">
          Edit
        </button>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <p className="flex gap-3 text-sm">
      <span className="w-28 shrink-0 text-faint">{k}</span>
      <span className="min-w-0 break-words text-ink">{v || "—"}</span>
    </p>
  );
}
