import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/aiProvider";
import { doubtRouterSchema } from "@/lib/zod-schemas";
import { formatChunksForPrompt } from "@/lib/embeddings";
import type { DoubtRouterResult, RetrievedChunk, LearnerProfile, RecentInteraction } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { question, chunks, profile, recentInteractions } = (await request.json()) as {
      question: string;
      chunks: RetrievedChunk[];
      profile: LearnerProfile | null;
      recentInteractions: RecentInteraction[];
    };

    if (!question) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    const contextStr = formatChunksForPrompt(chunks ?? []);

    const profileStr = profile
      ? `
Topic Mastery: ${JSON.stringify(profile.topicMastery)}
Mistake Frequencies: ${JSON.stringify(profile.mistakeFrequencies)}
Explanation Preference: ${profile.explanationPreference}
Total Doubts Resolved: ${profile.totalDoubtsResolved}
AI Resolved: ${profile.aiResolved}, Practice Resolved: ${profile.practiceResolved}, Teacher Resolved: ${profile.teacherResolved}`
      : "New student, no profile data yet.";

    const recentStr =
      recentInteractions && recentInteractions.length > 0
        ? recentInteractions
            .slice(0, 10)
            .map((i) => `[${i.type}] ${i.topic}${i.subtopic ? "/" + i.subtopic : ""}: ${i.outcome} (score: ${i.score ?? "N/A"})`)
            .join("\n")
        : "No recent interactions.";

    const systemPrompt = `You are the Doubtless Doubt Router Agent. Your job is to analyze a student's doubt and determine the best route for resolution.

ROUTING RULES:
- prerequisite_gap or concept_gap → route to "ai_explain", then the system will offer "practice"
- careless_error → route to "practice" directly
- needs_human OR low confidence (<0.4) → route to "teacher"
- If the student has failed on the same subtopic 3+ times recently → escalate to "teacher"
- Consider the learner profile to personalize the routing

Return a JSON object with exactly these keys:
- topic: string (broad subject, e.g. "Physics")
- subtopic: string
- difficulty: "easy" | "medium" | "hard"
- doubt_type: one of "concept_gap" | "prerequisite_gap" | "careless_error" | "needs_human"
- confidence: number between 0 and 1
- route: exactly one of "ai_explain" | "practice" | "teacher"
- reasoning: string (1-2 sentences)`;

    const prompt = `STUDENT DOUBT: "${question}"

REFERENCE MATERIAL:
${contextStr}

LEARNER PROFILE:
${profileStr}

RECENT INTERACTIONS:
${recentStr}

Analyze this doubt and determine the routing. Return JSON only.`;

    const result = await generateJSON<DoubtRouterResult>(prompt, systemPrompt);
    const validated = doubtRouterSchema.parse(normalizeRouterResult(result));

    const sameSubtopicFailures = (recentInteractions ?? []).filter(
      (i) =>
        i.subtopic === validated.subtopic &&
        (i.outcome === "failed" || i.outcome === "incorrect") &&
        Date.now() - i.timestamp < 7 * 24 * 60 * 60 * 1000
    ).length;

    if (sameSubtopicFailures >= 3 && validated.route !== "teacher") {
      validated.route = "teacher";
      validated.reasoning += " [ESCALATED: Repeated failures on this subtopic detected.]";
    }

    if (validated.confidence < 0.4 && validated.route !== "teacher") {
      validated.route = "teacher";
      validated.reasoning += " [ESCALATED: Low confidence in AI resolution.]";
    }

    return NextResponse.json(validated);
  } catch (error) {
    console.error("Doubt router error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Routing failed" },
      { status: 500 }
    );
  }
}

const DOUBT_TYPES = ["concept_gap", "prerequisite_gap", "careless_error", "needs_human"] as const;
const ROUTES = ["ai_explain", "practice", "teacher"] as const;
const ROUTE_FOR_TYPE: Record<(typeof DOUBT_TYPES)[number], (typeof ROUTES)[number]> = {
  concept_gap: "ai_explain",
  prerequisite_gap: "ai_explain",
  careless_error: "practice",
  needs_human: "teacher",
};

/** Models sometimes return near-miss values ("AI Explain", "ai_explain then practice", 85 for 0.85); coerce them before validating. */
function normalizeRouterResult(raw: Partial<Record<keyof DoubtRouterResult, unknown>>): DoubtRouterResult {
  const pick = <T extends string>(value: unknown, options: readonly T[]): T | undefined => {
    const v = String(value ?? "").toLowerCase().replace(/[\s-]+/g, "_");
    return options.find((o) => v === o) ?? options.find((o) => v.includes(o));
  };
  const doubt_type = pick(raw.doubt_type, DOUBT_TYPES) ?? "concept_gap";
  let confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.6;
  if (confidence > 1) confidence = confidence / 100;
  return {
    topic: String(raw.topic || "General"),
    subtopic: String(raw.subtopic || ""),
    difficulty: String(raw.difficulty || "medium"),
    doubt_type,
    confidence: Math.min(1, Math.max(0, confidence)),
    route: pick(raw.route, ROUTES) ?? ROUTE_FOR_TYPE[doubt_type],
    reasoning: String(raw.reasoning || ""),
  };
}
