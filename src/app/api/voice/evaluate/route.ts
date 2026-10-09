import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/aiProvider";
import { voiceEvaluationSchema } from "@/lib/zod-schemas";
import { formatChunksForPrompt } from "@/lib/embeddings";
import type { VoiceEvaluation, VoiceMetrics, RetrievedChunk } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { topic, transcript, metrics, chunks } = (await request.json()) as {
      topic: string;
      transcript: string;
      metrics: VoiceMetrics;
      chunks: RetrievedChunk[];
    };

    if (!topic || !transcript) {
      return NextResponse.json({ error: "Topic and transcript are required" }, { status: 400 });
    }

    const contextStr = formatChunksForPrompt(chunks ?? []);

    const systemPrompt = `You are a Feynman-method voice explanation evaluator in the Doubtless AI Education system.

The student attempted to explain a topic verbally. Evaluate their explanation using the Feynman technique criteria:
- Content Accuracy: Did they explain correctly?
- Structure: Was the explanation well-organized?
- Clarity: Was it clear and easy to follow?
- Confidence: Did they sound confident?

Also analyze their speaking patterns based on the provided metrics.

Return JSON with scores (0-10 each): content_accuracy, structure, clarity, confidence_score.
Also return: filler_analysis (string), where_they_hesitated (array of topics/moments), missing_concepts (array), better_explanation (how a top student would explain it), one_sentence_tip.`;

    const prompt = `TOPIC: "${topic}"

STUDENT'S VERBAL EXPLANATION TRANSCRIPT:
"${transcript}"

SPEAKING METRICS:
- Words per minute: ${metrics.wordsPerMinute}
- Filler word count: ${metrics.fillerWordCount}
- Filler word breakdown: ${JSON.stringify(metrics.fillerWords)}
- Long pauses (>3s): ${metrics.longPauseCount}
- Longest pause: ${metrics.longestPause}s

REFERENCE MATERIAL:
${contextStr}

Evaluate the explanation. Return JSON only.`;

    const result = await generateJSON<VoiceEvaluation>(prompt, systemPrompt);
    const validated = voiceEvaluationSchema.parse(result);

    return NextResponse.json(validated);
  } catch (error) {
    console.error("Voice evaluation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Evaluation failed" },
      { status: 500 }
    );
  }
}
