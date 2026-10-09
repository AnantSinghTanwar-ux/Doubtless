import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/aiProvider";
import { sessionSummarySchema } from "@/lib/zod-schemas";
import { updateSession, saveKnowledgeBase, getSession, getSessionMessages } from "@/lib/firestore";
import { recordSessionCompleted } from "@/lib/teacherStats";
import type { SessionSummary } from "@/types";

/** AI calls can take a while; give them room on serverless hosts. */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { sessionId, chatHistory, doubtContext } = (await request.json()) as {
      sessionId: string;
      chatHistory: string;
      doubtContext: string;
    };

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const before = await getSession(sessionId);
    if (!before) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (before.status === "completed" && before.summary) return NextResponse.json(before.summary);

    // Summarize what was actually said in the session chat; the client-sent history is only a fallback.
    const messages = await getSessionMessages(sessionId);
    const transcript = messages.length
      ? messages.map((m) => `${m.senderName}: ${m.text}`).join("\n").slice(-12000)
      : chatHistory || "(No chat messages were exchanged; the session happened over video.)";

    const systemPrompt = `You are a session summarizer in the Sθlvε AI Education system.

Summarize the teacher-student session into actionable knowledge.

Return JSON with:
- doubt: the core doubt/question
- root_cause: why the student was struggling
- explanation_that_worked: the explanation approach that resolved the doubt`;

    const prompt = `DOUBT CONTEXT: ${doubtContext}

CHAT HISTORY:
${transcript}

Summarize this session. Return JSON only.`;

    // Ending a session must never fail because the AI is unavailable: fall back to a plain summary.
    let validated: SessionSummary;
    let aiFailed = false;
    try {
      validated = sessionSummarySchema.parse(await generateJSON<SessionSummary>(prompt, systemPrompt));
    } catch (aiError) {
      console.error("Session summary AI failed, using fallback:", aiError);
      aiFailed = true;
      validated = {
        doubt: before.doubtContext.topic || "General doubt",
        root_cause: "An automatic summary wasn't available for this session.",
        explanation_that_worked: "Resolved in a live session with the teacher.",
      };
    }

    await updateSession(sessionId, {
      summary: validated,
      status: "completed",
      completedAt: Date.now(),
    });

    // Credit the teacher once per completed session, and remember which topic it was on (used for recommendations).
    await recordSessionCompleted(before.teacherId, before.doubtContext.topic).catch((e) => console.error("Could not record the session for the teacher:", e));
    await saveKnowledgeBase({
      sessionId,
      teacherId: before.teacherId,
      studentId: before.studentId,
      topic: before.doubtContext.topic,
      subtopic: before.doubtContext.subtopic,
      summary: validated,
      createdAt: Date.now(),
    });

    return NextResponse.json({ ...validated, aiFailed });
  } catch (error) {
    console.error("Session summarize error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Summarization failed" },
      { status: 500 }
    );
  }
}
