import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/aiProvider";
import { sessionSummarySchema } from "@/lib/zod-schemas";
import { updateSession, saveKnowledgeBase, getSession } from "@/lib/firestore";
import type { SessionSummary } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { sessionId, chatHistory, doubtContext } = (await request.json()) as {
      sessionId: string;
      chatHistory: string;
      doubtContext: string;
    };

    if (!sessionId || !chatHistory) {
      return NextResponse.json({ error: "sessionId and chatHistory are required" }, { status: 400 });
    }

    const systemPrompt = `You are a session summarizer in the Doubtless AI Education system.

Summarize the teacher-student session into actionable knowledge.

Return JSON with:
- doubt: the core doubt/question
- root_cause: why the student was struggling
- explanation_that_worked: the explanation approach that resolved the doubt`;

    const prompt = `DOUBT CONTEXT: ${doubtContext}

CHAT HISTORY:
${chatHistory}

Summarize this session. Return JSON only.`;

    const result = await generateJSON<SessionSummary>(prompt, systemPrompt);
    const validated = sessionSummarySchema.parse(result);

    await updateSession(sessionId, {
      summary: validated,
      status: "completed",
      completedAt: Date.now(),
    });

    const session = await getSession(sessionId);
    if (session) {
      await saveKnowledgeBase({
        sessionId,
        teacherId: session.teacherId,
        studentId: session.studentId,
        topic: session.doubtContext.topic,
        subtopic: session.doubtContext.subtopic,
        summary: validated,
        createdAt: Date.now(),
      });
    }

    return NextResponse.json(validated);
  } catch (error) {
    console.error("Session summarize error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Summarization failed" },
      { status: 500 }
    );
  }
}
