import { currentUser, withUsage } from "@/lib/usage";
import { remember } from "@/lib/memory";
import { after, NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/aiProvider";
import { vivaReportSchema } from "@/lib/zod-schemas";
import type { VivaReport, VivaAnswer } from "@/types";

/** AI calls can take a while; give them room on serverless hosts. */
export const maxDuration = 300;

async function handlePost(request: NextRequest) {
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

    const { uid } = currentUser();
    if (validated.weak_topics.length) {
      after(() =>
        remember(uid, {
          kind: "viva",
          topic,
          text: `Viva on ${topic}, scored ${validated.overall_score}/10`,
          takeaway: `Weak on: ${validated.weak_topics.slice(0, 4).join(", ")}`,
        })
      );
    }

    return NextResponse.json(validated);
  } catch (error) {
    console.error("Viva report error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Report generation failed" },
      { status: 500 }
    );
  }
}

/** Tracks the AI cost of each request (see src/lib/usage.ts). */
export const POST = withUsage("viva.report", handlePost);
