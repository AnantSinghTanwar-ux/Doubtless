import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/aiProvider";
import { vivaReportSchema } from "@/lib/zod-schemas";
import type { VivaReport, VivaAnswer } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { topic, answers } = (await request.json()) as {
      topic: string;
      answers: VivaAnswer[];
    };

    if (!topic || !answers || answers.length === 0) {
      return NextResponse.json({ error: "Topic and answers are required" }, { status: 400 });
    }

    const systemPrompt = `You are a viva report generator in the Sθlvε AI Education system.

Analyze the complete viva session and generate a comprehensive report.

Return JSON with:
- answers: the same answers array with scores and feedback
- confidence_trend: array of confidence scores across questions
- weak_topics: areas where the student struggled
- study_plan: recommended study actions (3-5 items)
- overall_score: weighted average of all question scores (0-10)`;

    const answersStr = answers
      .map(
        (a, i) =>
          `Q${i + 1}: ${a.question}\nStudent Answer: ${a.answer}\nScore: ${a.score}/10\nFeedback: ${a.feedback}\nConfidence: ${a.confidence}/10`
      )
      .join("\n\n");

    const prompt = `VIVA TOPIC: "${topic}"

COMPLETE VIVA SESSION:
${answersStr}

Generate the viva report. Return JSON only.`;

    const result = await generateJSON<VivaReport>(prompt, systemPrompt);
    const validated = vivaReportSchema.parse(result);

    return NextResponse.json(validated);
  } catch (error) {
    console.error("Viva report error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Report generation failed" },
      { status: 500 }
    );
  }
}
