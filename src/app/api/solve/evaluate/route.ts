import { NextRequest, NextResponse } from "next/server";
import { generateJSON, generateWithImage } from "@/lib/aiProvider";
import { solutionEvaluationSchema } from "@/lib/zod-schemas";
import { formatChunksForPrompt } from "@/lib/embeddings";
import type { SolutionEvaluation, RetrievedChunk } from "@/types";

export async function POST(request: NextRequest) {
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

    const systemPrompt = `You are a meticulous solution evaluator in the Doubtless AI Education system.

${hasVault ? `Ground your evaluation in the reference material provided. Cite sources (PDF name, page number) when relevant.` : `No reference material available. Evaluate using general knowledge. For GK questions, evaluate factual accuracy, completeness, and reasoning order instead of mathematical correctness.`}

Evaluate each step of the student's solution and return JSON with:
- steps: array of {step (1-indexed), verdict ("correct"|"error"|"redundant"|"unclear"), error_type (optional), explanation, fix (optional)}
- first_error_step: number or null
- rubric: {correctness (0-10), method (0-10), clarity_notation (0-10), total (0-10 weighted average)}
- model_solution: a clean, correct solution for comparison
- source_citations: array of {pdf_name, page} if vault context used, empty array otherwise`;

    let result: SolutionEvaluation;

    if (imageBase64 && imageMimeType) {
      const prompt = `QUESTION: "${question}"

REFERENCE MATERIAL:
${contextStr}

The student has uploaded a photo of their handwritten solution. Analyze each step visible in the image, evaluate correctness, and return the evaluation JSON.`;

      const response = await generateWithImage(prompt, imageBase64, imageMimeType, systemPrompt);
      result = JSON.parse(response) as SolutionEvaluation;
    } else if (steps) {
      const stepsStr = steps.map((s, i) => `Step ${i + 1}: ${s}`).join("\n");

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

    const validated = solutionEvaluationSchema.parse(result);

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
