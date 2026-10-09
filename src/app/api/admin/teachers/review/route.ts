import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireAdmin } from "@/lib/serverAuth";
import { getTeacherApplication, getTeacherByUid, updateTeacherApplication, upsertTeacher } from "@/lib/firestore";

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const { uid, decision, note } = await request.json();
    if (decision !== "approve" && decision !== "reject") {
      return NextResponse.json({ error: "decision must be approve or reject" }, { status: 400 });
    }
    const app = await getTeacherApplication(String(uid));
    if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    const reviewNote = typeof note === "string" ? note.trim().slice(0, 1000) : "";
    if (decision === "reject" && !reviewNote) {
      return NextResponse.json({ error: "Tell the applicant why they were rejected." }, { status: 400 });
    }

    if (decision === "approve") {
      if (!app.files.selfie) {
        return NextResponse.json({ error: "This teacher registered without a camera. They must complete live verification before approval." }, { status: 400 });
      }
      // Merge so an existing teacher keeps their rating, sessions and availability.
      await upsertTeacher(app.uid, {
        uid: app.uid,
        name: app.personal.fullName,
        email: app.email,
        photoURL: `/api/teacher/photo?uid=${encodeURIComponent(app.uid)}&v=${Date.now()}`,
        subjects: app.professional.subjects,
        specialties: app.professional.specialties,
        headline: app.personal.headline,
        bio: app.personal.bio,
        experienceYears: app.professional.experienceYears,
        institution: app.professional.institution,
        verified: true,
      });
    } else if (await getTeacherByUid(app.uid)) {
      await upsertTeacher(app.uid, { verified: false });
    }

    await updateTeacherApplication(app.uid, {
      status: decision === "approve" ? "approved" : "rejected",
      reviewedAt: Date.now(),
      reviewedBy: admin.email,
      reviewNote,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Review error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Review failed" }, { status: 500 });
  }
}
