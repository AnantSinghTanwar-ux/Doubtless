import { withUsage } from "@/lib/usage";
import { NextRequest, NextResponse } from "next/server";
import { generateJSON, generateWithImage, parseJSON } from "@/lib/aiProvider";
import { nvidiaConfigured, nvidiaTranscribe } from "@/lib/nvidia";
import { solutionEvaluationSchema } from "@/lib/zod-schemas";
import { formatChunksForPrompt } from "@/lib/embeddings";
import type { SolutionEvaluation, RetrievedChunk } from "@/types";

/** AI calls can take a while; give them room on serverless hosts. */
export const maxDuration = 300;

async function handlePost(request: NextRequest) {
  try {
    const { question, steps, imageBase64, imageMimeType, chunks, vaultFileName } = (await request.json()) as {
      question: string;
      steps?: string[];
      imageBase64?: string;
      imageMimeType?: string;
      chunks: RetrievedChunk[];
      vaultFileName?: string;
    };

    if (!question) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    if (!steps && !imageBase64) {
      return NextResponse.json({ error: "Either steps or image is required" }, { status: 400 });
    }

    const contextStr = formatChunksForPrompt(chunks ?? []);
    const hasVault = chunks && chunks.length > 0;

    const systemPrompt = `You are a meticulous solution evaluator in the Sθlvε AI Education system.

${hasVault ? `Ground your evaluation in the reference material provided. Cite sources (PDF name, page number) when relevant.` : `No reference material available. Evaluate using general knowledge. For GK questions, evaluate factual accuracy, completeness, and reasoning order instead of mathematical correctness.`}

Evaluate each step of the student's solution and return JSON with:
- steps: array of {step (1-indexed), verdict ("correct"|"error"|"redundant"|"unclear"), error_type (optional), explanation, fix (optional)}
- first_error_step: number or null
- rubric: {correctness (0-10), method (0-10), clarity_notation (0-10), total (0-10 weighted average)}
- model_solution: a clean, correct solution for comparison
- source_citations: array of {pdf_name, page} if vault context used, empty array otherwise`;

    let result: SolutionEvaluation;

    // Photos: read the handwriting with a vision model, then judge the steps with the stronger text model.
    let transcribed: string[] | null = null;
    if (!steps?.length && imageBase64 && imageMimeType && nvidiaConfigured()) {
      try {
        const lines = await nvidiaTranscribe(imageBase64, imageMimeType);
        if (lines.length > 0) transcribed = lines;
      } catch (err) {
        console.warn("[solve] handwriting transcription failed, using direct image evaluation:", err instanceof Error ? err.message : err);
      }
    }
    const studentSteps = transcribed ?? steps;

    if (!transcribed && imageBase64 && imageMimeType) {
      const prompt = `QUESTION: "${question}"

REFERENCE MATERIAL:
${contextStr}

The student has uploaded a photo of their handwritten solution. Analyze each step visible in the image, evaluate correctness, and return the evaluation JSON.`;

      const response = await generateWithImage(prompt, imageBase64, imageMimeType, systemPrompt);
      result = parseJSON<SolutionEvaluation>(response, "Vision model");
    } else if (studentSteps) {
      const stepsStr = studentSteps.map((s, i) => `Step ${i + 1}: ${s}`).join("\n");

      const prompt = `QUESTION: "${question}"

STUDENT'S SOLUTION:
${stepsStr}

REFERENCE MATERIAL:
${contextStr}

Evaluate each step. Return JSON only.`;

      result = await generateJSON<SolutionEvaluation>(prompt, systemPrompt);
    } else {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const validated = solutionEvaluationSchema.parse(normalizeEvaluation(result));

    if (!hasVault) {
      validated.source_citations = [];
    }

    return NextResponse.json(validated);
  } catch (error) {
    console.error("Evaluation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Evaluation failed" },
      { status: 500 }
    );
  }
}

const VERDICT_SCORE: Record<string, number> = { correct: 1, redundant: 0.6, unclear: 0.5, error: 0 };

/**
 * Smaller (especially vision) models often leave out parts of the requested JSON. Rebuild the missing pieces from
 * what they did return instead of failing the whole evaluation.
 */
function normalizeEvaluation(raw: Partial<SolutionEvaluation>): SolutionEvaluation {
  const steps = (Array.isArray(raw.steps) ? raw.steps : []).map((s, i) => ({ ...s, step: Number(s?.step) || i + 1 }));
  const avg = steps.length ? steps.reduce((n, s) => n + (VERDICT_SCORE[String(s.verdict)] ?? 0.5), 0) / steps.length : 0.5;
  const base = Math.round(avg * 100) / 10;
  const rubric =
    raw.rubric && typeof raw.rubric === "object"
      ? raw.rubric
      : { correctness: base, method: base, clarity_notation: base, total: base };
  const firstError = steps.find((s) => s.verdict === "error")?.step ?? null;
  return {
    steps,
    first_error_step: raw.first_error_step ?? firstError,
    rubric,
    model_solution: raw.model_solution ?? "",
    source_citations: Array.isArray(raw.source_citations) ? raw.source_citations : [],
  } as SolutionEvaluation;
}

/** Tracks the AI cost of each request (see src/lib/usage.ts). */
export const POST = withUsage("solve", handlePost);
