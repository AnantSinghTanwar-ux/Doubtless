import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/serverAuth";
import { getSession } from "@/lib/firestore";
import { saveReview } from "@/lib/teacherStats";
import type { ReviewResolved } from "@/types";

const stars = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
};

/** A student reviews the teacher they just spoke to. Optional, once per session, and only for a session that has ended. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const explain = stars(body.explain);
    const depth = stars(body.depth);
    const solving = stars(body.solving);
    const resolved = ["yes", "partly", "no"].includes(body.resolved) ? (body.resolved as ReviewResolved) : null;
    if (!sessionId || !explain || !depth || !solving || !resolved) {
      return NextResponse.json({ error: "Rate all three areas (1 to 5 stars) and say whether your doubt was resolved." }, { status: 400 });
    }

    const session = await getSession(sessionId);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (session.studentId !== user.uid) return NextResponse.json({ error: "Only the student in this session can review it." }, { status: 403 });
    if (session.status !== "completed") return NextResponse.json({ error: "You can review a session once it has ended." }, { status: 409 });

    const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 600) : "";
    const saved = await saveReview({
      sessionId,
      teacherId: session.teacherId,
      studentId: user.uid,
      topic: session.doubtContext.topic || "General",
      subtopic: session.doubtContext.subtopic || "",
      explain,
      depth,
      solving,
      resolved,
      ...(comment ? { comment } : {}),
      createdAt: Date.now(),
    });
    return NextResponse.json({ ok: true, alreadyReviewed: !saved });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Review error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save your review" }, { status: 500 });
  }
}
