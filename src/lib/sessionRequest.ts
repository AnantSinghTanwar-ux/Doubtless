import { createSession } from "./firestore";
import { generateJitsiRoom } from "./utils";
import type { DoubtRouterResult } from "@/types";

/** Opens a pending session with a teacher, carrying the doubt so the teacher knows what it is before accepting. */
export async function requestSession(opts: { studentId: string; teacherId: string; routerResult?: Partial<DoubtRouterResult> | null; question?: string }): Promise<string> {
  const r = opts.routerResult ?? {};
  const asked = opts.question?.trim() ? `Student asked: "${opts.question.trim().slice(0, 400)}"` : "Student requested a live session.";
  const diagnosis = r.reasoning ? ` Diagnosis: ${r.reasoning}` : "";
  return createSession({
    studentId: opts.studentId,
    teacherId: opts.teacherId,
    doubtId: "manual-request",
    status: "pending",
    jitsiRoom: generateJitsiRoom(opts.studentId),
    doubtContext: {
      topic: r.topic || "General",
      subtopic: r.subtopic || "",
      difficulty: r.difficulty || "medium",
      doubt_type: r.doubt_type || "needs_human",
      confidence: r.confidence ?? 0,
      route: "teacher",
      reasoning: `${asked}${diagnosis}`,
    },
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  });
}
