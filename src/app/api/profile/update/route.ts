import { NextRequest, NextResponse } from "next/server";
import { getLearnerProfile, updateLearnerProfile, addRecentInteraction } from "@/lib/firestore";
import type { RecentInteraction } from "@/types";
import { recordLearning } from "@/lib/learnerStats";

export async function POST(request: NextRequest) {
  try {
    const { userId, interaction, topicUpdate, mistakeUpdate } = (await request.json()) as {
      userId: string;
      interaction?: RecentInteraction;
      topicUpdate?: { topic: string; mastery: number };
      mistakeUpdate?: { type: string; count: number };
    };

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const profile = await getLearnerProfile(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (interaction) {
      await addRecentInteraction(userId, interaction);
    }

    if (topicUpdate) {
      const currentMastery = profile.topicMastery[topicUpdate.topic] ?? 50;
      const newMastery = Math.round(currentMastery * 0.7 + topicUpdate.mastery * 0.3);
      updates[`topicMastery.${topicUpdate.topic}`] = Math.max(0, Math.min(100, newMastery));
    }

    if (mistakeUpdate) {
      const current = profile.mistakeFrequencies[mistakeUpdate.type] ?? 0;
      updates[`mistakeFrequencies.${mistakeUpdate.type}`] = current + mistakeUpdate.count;
    }

    await updateLearnerProfile(userId, updates);

    // A practice set finished with a good score counts as a doubt sorted out by practice.
    if (interaction?.type === "practice" && interaction.outcome === "mastered") {
      await recordLearning(userId, { resolvedBy: "practice" });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}
