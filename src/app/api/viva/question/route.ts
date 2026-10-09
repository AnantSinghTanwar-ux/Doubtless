import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/aiProvider";
import { vivaQuestionSchema, vivaAnswerEvalSchema } from "@/lib/zod-schemas";
import { formatChunksForPrompt } from "@/lib/embeddings";
import type { RetrievedChunk } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { topic, previousAnswers, chunks, questionNumber } = (await request.json()) as {
      topic: string;
      previousAnswers: Array<{ question: string; answer: string; score: number }>;
      chunks: RetrievedChunk[];
      questionNumber: number;
    };

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const contextStr = formatChunksForPrompt(chunks ?? []);

    const prevStr =
      previousAnswers && previousAnswers.length > 0
        ? previousAnswers
            .map((a, i) => `Q${i + 1}: ${a.question}\nA: ${a.answer}\nScore: ${a.score}/10`)
            .join("\n\n")
        : "No previous answers yet. This is the first question.";

    const avgScore =
      previousAnswers && previousAnswers.length > 0
        ? previousAnswers.reduce((sum, a) => sum + a.score, 0) / previousAnswers.length
        : 5;

    const systemPrompt = `You are an AI oral examiner in the Doubtless viva system. Generate adaptive follow-up questions.

Rules:
- If the student scored well (>7), increase difficulty and probe deeper
- If the student scored poorly (<5), ask a simpler question to build confidence, or probe the weak spot
- Ask one question at a time
- Questions should test understanding, not memorization
- Ground questions in the reference material when available
- This is question ${questionNumber} of 5

Return JSON with: question (string), difficulty (1-5), topic (the specific sub-area being tested).`;

    const prompt = `VIVA TOPIC: "${topic}"

PREVIOUS Q&A:
${prevStr}

Average score so far: ${avgScore.toFixed(1)}/10

REFERENCE MATERIAL:
${contextStr}

Generate the next viva question. Return JSON only.`;

    const result = await generateJSON<{ question: string; difficulty: number; topic: string }>(prompt, systemPrompt);
    const validated = vivaQuestionSchema.parse(result);

    return NextResponse.json(validated);
  } catch (error) {
    console.error("Viva question error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Question generation failed" },
      { status: 500 }
    );
  }
}
