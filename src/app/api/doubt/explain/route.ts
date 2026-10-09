import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/aiProvider";
import { aiExplanationSchema } from "@/lib/zod-schemas";
import { formatChunksForPrompt } from "@/lib/embeddings";
import type { RetrievedChunk, DoubtRouterResult } from "@/types";
import { searchKnowledgeBase } from "@/lib/firestore";

export async function POST(request: NextRequest) {
  try {
    const { question, chunks, routerResult } = (await request.json()) as {
      question: string;
      chunks: RetrievedChunk[];
      routerResult: DoubtRouterResult;
    };

    if (!question || !routerResult) {
      return NextResponse.json({ error: "Question and routerResult are required" }, { status: 400 });
    }

    const contextStr = formatChunksForPrompt(chunks ?? []);

    let pastSessionContext = "";
    let basedOnPastSession = false;
    try {
      const pastEntries = await searchKnowledgeBase(routerResult.topic, routerResult.subtopic);
      if (pastEntries.length > 0) {
        basedOnPastSession = true;
        pastSessionContext = pastEntries
          .map(
            (e) =>
              `Past Session: Doubt: ${e.summary.doubt}, Root Cause: ${e.summary.root_cause}, What Worked: ${e.summary.explanation_that_worked}`
          )
          .join("\n\n");
      }
    } catch {
      // Knowledge base search is optional
    }

    const systemPrompt = `You are a patient, expert tutor in the SolVε AI Education system. Explain concepts clearly and thoroughly.

The doubt has been classified as: ${routerResult.doubt_type}
Topic: ${routerResult.topic}, Subtopic: ${routerResult.subtopic}, Difficulty: ${routerResult.difficulty}

Guidelines:
- For concept_gap: Build understanding from fundamentals, use analogies
- For prerequisite_gap: Identify and teach the missing prerequisite first
- For careless_error: Point out the specific error pattern
- Use the reference material when available
- Keep explanations clear, structured, and encouraging

${pastSessionContext ? `PAST TEACHER SESSION INSIGHTS (use these to improve your explanation):\n${pastSessionContext}` : ""}

Return JSON with: explanation (markdown formatted), key_concepts (array), analogies (array, optional), follow_up_questions (array, optional), based_on_past_session (boolean).`;

    const prompt = `STUDENT DOUBT: "${question}"

REFERENCE MATERIAL:
${contextStr}

Provide a thorough, clear explanation. Return JSON only.`;

    const result = await generateJSON<{
      explanation: string;
      key_concepts: string[];
      analogies?: string[];
      follow_up_questions?: string[];
      based_on_past_session?: boolean;
    }>(prompt, systemPrompt);

    const validated = aiExplanationSchema.parse({
      ...result,
      based_on_past_session: basedOnPastSession || result.based_on_past_session,
    });

    return NextResponse.json(validated);
  } catch (error) {
    console.error("Explanation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Explanation failed" },
      { status: 500 }
    );
  }
}
