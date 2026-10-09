import { currentUser, withUsage } from "@/lib/usage";
import { after, NextRequest, NextResponse } from "next/server";
import { formatMemoriesForPrompt, recall, remember } from "@/lib/memory";
import { recordLearning } from "@/lib/learnerStats";
import { generateJSON } from "@/lib/aiProvider";
import { aiExplanationSchema } from "@/lib/zod-schemas";
import { formatChunksForPrompt } from "@/lib/embeddings";
import type { RetrievedChunk, DoubtRouterResult } from "@/types";
import { searchKnowledgeBase } from "@/lib/firestore";

/** AI calls can take a while; give them room on serverless hosts. */
export const maxDuration = 300;

async function handlePost(request: NextRequest) {
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
    // The student's own related history (past doubts, teacher sessions, vivas), matched on this doubt's topic.
    const { uid } = currentUser();
    const memories = await recall(uid, question, { topic: [routerResult.topic, routerResult.subtopic].filter(Boolean).join(" / ") });

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

    const systemPrompt = `You are a patient, expert tutor in the Sθlvε AI Education system. Explain concepts clearly and thoroughly.

The doubt has been classified as: ${routerResult.doubt_type}
Topic: ${routerResult.topic}, Subtopic: ${routerResult.subtopic}, Difficulty: ${routerResult.difficulty}

Guidelines:
- For concept_gap: Build understanding from fundamentals, use analogies
- For prerequisite_gap: Identify and teach the missing prerequisite first
- For careless_error: Point out the specific error pattern
- Use the reference material when available
- Keep explanations clear, structured, and encouraging

${memories.length ? `THIS STUDENT'S OWN HISTORY (related things they asked or worked on before). Connect to it when it helps, e.g. "this builds on the X you asked about on <date>". Don't repeat it back verbatim:\n${formatMemoriesForPrompt(memories.slice(0, 3))}\n\n` : ""}${pastSessionContext ? `PAST TEACHER SESSION INSIGHTS (use these to improve your explanation):\n${pastSessionContext}` : ""}

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

    // Remember this doubt so later questions can build on it.
    after(() =>
      remember(uid, {
        kind: "doubt",
        topic: [routerResult.topic, routerResult.subtopic].filter(Boolean).join(" / "),
        text: question,
        takeaway: (validated.key_concepts ?? []).slice(0, 4).join("; ") || validated.explanation.slice(0, 300),
      })
    );

    // Dashboard: one more doubt sorted out by AI, and a mild "this topic needs work" signal (asking about it means it isn't solid).
    after(() =>
      recordLearning(uid, {
        resolvedBy: "ai",
        topic: routerResult.topic,
        mastery: 40,
        interaction: { type: "doubt", topic: routerResult.topic, subtopic: routerResult.subtopic, outcome: "ai_explained", timestamp: Date.now() },
      })
    );

    return NextResponse.json({ ...validated, memories: memories.map(({ kind, topic, text, at }) => ({ kind, topic, text, at })) });
  } catch (error) {
    console.error("Explanation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Explanation failed" },
      { status: 500 }
    );
  }
}

/** Tracks the AI cost of each request (see src/lib/usage.ts). */
export const POST = withUsage("doubt.explain", handlePost);
