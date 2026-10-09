import { NextRequest, NextResponse, after } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/serverAuth";
import { getTeacherApplication, getTeacherByUid, getUserProfile, saveTeacherApplication, updateUserProfile, upsertTeacher } from "@/lib/firestore";
import { runScreening, storeFile, type VerificationFileKey } from "@/lib/teacherVerification";
import type { TeacherApplication } from "@/types";

export const maxDuration = 120;

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim().slice(0, 60)).slice(0, 12) : [];

const DOCUMENT_KEYS: VerificationFileKey[] = ["idDocument", "certificate"];
const LIVE_KEYS: VerificationFileKey[] = ["selfie", "video"];

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const existing = await getTeacherApplication(user.uid);
    if (existing?.status === "approved") {
      return NextResponse.json({ error: "Your teacher account is already verified." }, { status: 409 });
    }

    const form = await request.formData();
    const details = JSON.parse(str(form.get("details"), 20000) || "{}");
    const personal = {
      fullName: str(details.personal?.fullName, 100),
      phone: str(details.personal?.phone, 30),
      city: str(details.personal?.city, 80),
      headline: str(details.personal?.headline, 120),
      bio: str(details.personal?.bio, 1500),
    };
    const professional = {
      degree: str(details.professional?.degree, 120),
      institution: str(details.professional?.institution, 160),
      graduationYear: Number(details.professional?.graduationYear) || 0,
      experienceYears: Math.max(0, Math.min(60, Number(details.professional?.experienceYears) || 0)),
      currentRole: str(details.professional?.currentRole, 120),
      linkedinUrl: str(details.professional?.linkedinUrl, 300),
      subjects: list(details.professional?.subjects),
      specialties: list(details.professional?.specialties),
    };
    // No camera on the device: the teacher registers, but stays unverified until they complete live checks.
    const skipped = details.liveness?.skipped === true;
    const liveness = {
      selfieChallenge: skipped ? "" : str(details.liveness?.selfieChallenge, 200),
      selfieCapturedAt: skipped ? 0 : Number(details.liveness?.selfieCapturedAt) || 0,
      videoPrompt: skipped ? "" : str(details.liveness?.videoPrompt, 300),
      videoDurationSec: skipped ? 0 : Number(details.liveness?.videoDurationSec) || 0,
      skipped,
    };

    const missing = [
      !personal.fullName && "full name",
      !/^[+\d][\d\s-]{7,}$/.test(personal.phone) && "a valid phone number",
      personal.bio.length < 80 && "a bio of at least 80 characters",
      !professional.degree && "highest qualification",
      !professional.institution && "institution",
      professional.subjects.length === 0 && "at least one subject",
      !skipped && liveness.videoDurationSec < 15 && "a video introduction of at least 15 seconds",
      // A live capture must be recent; this rejects photos picked from a gallery or replayed old captures.
      !skipped && Date.now() - liveness.selfieCapturedAt > 60 * 60 * 1000 && "a live selfie captured in this session",
    ].filter(Boolean);
    if (missing.length) return NextResponse.json({ error: `Please provide ${missing.join(", ")}.` }, { status: 400 });

    const files = {} as TeacherApplication["files"];
    for (const key of [...DOCUMENT_KEYS, ...(skipped ? [] : LIVE_KEYS)]) {
      const file = form.get(key);
      if (!(file instanceof File)) {
        // Resubmissions may keep previously uploaded documents.
        const previous = DOCUMENT_KEYS.includes(key) ? existing?.files?.[key] : undefined;
        if (previous) {
          files[key] = previous;
          continue;
        }
        return NextResponse.json({ error: `Missing ${key}` }, { status: 400 });
      }
      try {
        files[key] = await storeFile(user.uid, key, file);
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid file" }, { status: 400 });
      }
    }
    const videoFrames = form
      .getAll("videoFrames")
      .map((f) => (typeof f === "string" && f.startsWith("data:image/jpeg;base64,") ? f : ""))
      .filter(Boolean)
      .slice(0, 3);

    const app: TeacherApplication = {
      uid: user.uid,
      email: user.email,
      status: skipped ? "unverified" : "pending",
      personal,
      professional,
      files,
      liveness,
      ...(skipped ? {} : { screening: { status: "running" as const } }),
      submittedAt: Date.now(),
    };
    await saveTeacherApplication(app);

    const profile = await getUserProfile(user.uid);
    if (profile && profile.role !== "teacher") await updateUserProfile(user.uid, { role: "teacher" });

    // The live selfie is the public profile photo students see (cache-busted so retakes show immediately).
    const photoURL = files.selfie ? `/api/teacher/photo?uid=${encodeURIComponent(user.uid)}&v=${Date.now()}` : null;
    if (photoURL) await updateUserProfile(user.uid, { photoURL });

    // Every applicant gets a teacher record so their dashboard works right away; only admins set verified.
    const teacherFields = {
      uid: user.uid,
      name: personal.fullName,
      email: user.email,
      subjects: professional.subjects,
      specialties: professional.specialties,
      headline: personal.headline,
      bio: personal.bio,
      experienceYears: professional.experienceYears,
      institution: professional.institution,
      verified: false,
      ...(photoURL ? { photoURL } : {}),
    };
    const teacher = await getTeacherByUid(user.uid);
    await upsertTeacher(
      user.uid,
      teacher ? teacherFields : { photoURL: null, rating: 0, ratingCount: 0, availability: false, doubtsResolved: 0, ...teacherFields }
    );

    if (!skipped) after(() => runScreening(app, videoFrames));
    return NextResponse.json({ ok: true, status: app.status });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Teacher application error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Submission failed" }, { status: 500 });
  }
}
