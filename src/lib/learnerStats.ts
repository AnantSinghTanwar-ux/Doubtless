import { doc, getDoc, increment, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { LearnerProfile, RecentInteraction } from "@/types";

/**
 * Updates the numbers on a student's dashboard. Called from the server routes that finish a piece of help, so it
 * works from any page or device and uses the verified user, not something the browser sends.
 *
 *   ai       - an AI explanation was delivered      (counts as a doubt resolved by AI)
 *   practice - a practice set was finished well     (counts as resolved by practice)
 *   teacher  - a live teacher session was completed (counts as resolved by a teacher)
 *
 * `mastery` (0-100) nudges the topic's mastery toward that value, which is what puts a topic in "Focus areas".
 */
export type ResolvedBy = "ai" | "practice" | "teacher";

const FIELD: Record<ResolvedBy, keyof Pick<LearnerProfile, "aiResolved" | "practiceResolved" | "teacherResolved">> = {
  ai: "aiResolved",
  practice: "practiceResolved",
  teacher: "teacherResolved",
};

/** Topic names become map keys: keep them short and free of characters Firestore treats as paths. */
const topicKey = (t: string) => t.replace(/[.\/\[\]*`~]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

export async function recordLearning(
  userId: string,
  opts: { resolvedBy?: ResolvedBy; interaction?: RecentInteraction; topic?: string; mastery?: number }
): Promise<void> {
  if (!userId || userId === "anonymous") return;
  try {
    const ref = doc(db, "profiles", userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const profile = snap.data() as LearnerProfile;

    const update: Record<string, unknown> = { updatedAt: Date.now() };
    if (opts.resolvedBy) {
      update.totalDoubtsResolved = increment(1);
      update[FIELD[opts.resolvedBy]] = increment(1);
    }
    if (opts.interaction) {
      // Newest first, 50 kept (same shape addRecentInteraction uses).
      update.recentInteractions = [opts.interaction, ...(profile.recentInteractions ?? [])].slice(0, 50);
    }
    await updateDoc(ref, update);

    const key = opts.topic ? topicKey(opts.topic) : "";
    if (key && typeof opts.mastery === "number") {
      const current = profile.topicMastery?.[key] ?? 50;
      const next = Math.max(0, Math.min(100, Math.round(current * 0.7 + opts.mastery * 0.3)));
      await setDoc(ref, { topicMastery: { [key]: next } }, { merge: true });
    }
  } catch (err) {
    console.warn("[learnerStats] could not update:", err instanceof Error ? err.message : err);
  }
}
