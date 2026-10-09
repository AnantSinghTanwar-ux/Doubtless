import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/aiProvider";
import { practiceSetSchema, practiceEvalSchema } from "@/lib/zod-schemas";
import { formatChunksForPrompt } from "@/lib/embeddings";
import type { RetrievedChunk, LearnerProfile, PracticeQuestion } from "@/types";

/** AI calls can take a while; give them room on serverless hosts. */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { action, topic, subtopic, chunks, profile, question, answer } = (await request.json()) as {
      action: "generate" | "evaluate";
      topic: string;
      subtopic: string;
      chunks: RetrievedChunk[];
      profile: LearnerProfile | null;
      question?: PracticeQuestion;
      answer?: string;
    };

    if (action === "generate") {
      const contextStr = formatChunksForPrompt(chunks ?? []);
      const mastery = profile?.topicMastery?.[subtopic] ?? profile?.topicMastery?.[topic] ?? 50;
      const difficulty = mastery > 70 ? "hard" : mastery > 40 ? "medium" : "easy";

      const systemPrompt = `You are a practice question generator in the Sθlvε AI Education system.

Generate 5 practice questions on the given topic/subtopic.
Difficulty level: ${difficulty} (based on student mastery: ${mastery}%)
Ground questions in the reference material when available.

Return JSON with: questions (array of {question, difficulty (1-5), topic, subtopic, expected_answer, hints (array of 2-3 hints)}).`;

      const prompt = `TOPIC: "${topic}"
SUBTOPIC: "${subtopic}"

REFERENCE MATERIAL:
${contextStr}

Generate 5 practice questions. Return JSON only.`;

      const result = await generateJSON<{ questions: PracticeQuestion[] }>(prompt, systemPrompt);
      const validated = practiceSetSchema.parse(result);

      return NextResponse.json(validated);
    }

    if (action === "evaluate") {
      if (!question || !answer) {
        return NextResponse.json({ error: "Question and answer are required for evaluation" }, { status: 400 });
      }

      const systemPrompt = `You are a practice answer evaluator. Evaluate the student's answer and provide feedback.

Return JSON with: correct (boolean), feedback (string), score (0-10).`;

      const prompt = `QUESTION: "${question.question}"
EXPECTED ANSWER: "${question.expected_answer}"
STUDENT'S ANSWER: "${answer}"

Evaluate the answer. Return JSON only.`;

      const result = await generateJSON<{ correct: boolean; feedback: string; score: number }>(prompt, systemPrompt);
      const validated = practiceEvalSchema.parse(result);

      return NextResponse.json(validated);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Practice error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Practice failed" },
      { status: 500 }
    );
  }
}
