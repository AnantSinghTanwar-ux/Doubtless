import { doc, runTransaction, type DocumentReference, type Transaction } from "firebase/firestore";
import { db } from "./firebase";
import { canonicalSubject, statKey } from "./teacherRanking";
import type { RatingSums, TeacherProfile, TeacherReview, TopicStat } from "@/types";

/** Transactions make both writers safe to run at the same time: two students reviewing, or a review landing as a session ends. */

const empty = (): RatingSums => ({ n: 0, explain: 0, depth: 0, solving: 0, resolved: 0 });
const resolvedValue = { yes: 1, partly: 0.5, no: 0 } as const;

function add(s: RatingSums, r: Pick<TeacherReview, "explain" | "depth" | "solving" | "resolved">): RatingSums {
  return { n: s.n + 1, explain: s.explain + r.explain, depth: s.depth + r.depth, solving: s.solving + r.solving, resolved: s.resolved + resolvedValue[r.resolved] };
}

const readTeacher = async (tx: Transaction, ref: DocumentReference) => {
  const snap = await tx.get(ref);
  return snap.exists() ? (snap.data() as TeacherProfile) : null;
};

/**
 * Stores a student's review and folds it into the teacher's totals, once per session.
 * Returns false if this session was already reviewed (so a double click or retry changes nothing).
 */
export async function saveReview(review: Omit<TeacherReview, "id">): Promise<boolean> {
  const reviewRef = doc(db, "reviews", review.sessionId);
  const teacherRef = doc(db, "teachers", review.teacherId);
  return runTransaction(db, async (tx) => {
    if ((await tx.get(reviewRef)).exists()) return false;
    const teacher = await readTeacher(tx, teacherRef);
    if (!teacher) throw new Error("Teacher not found");

    const overall = add(teacher.reviewStats ?? empty(), review);
    const key = statKey(review.topic, review.subtopic);
    const prev: TopicStat = teacher.topicStats?.[key] ?? { ...empty(), name: canonicalSubject(review.topic, review.subtopic) ?? review.topic, sessions: 0 };
    const topic: TopicStat = { ...add(prev, review), name: prev.name, sessions: prev.sessions };

    tx.set(reviewRef, { ...review, id: review.sessionId });
    tx.set(
      teacherRef,
      {
        reviewStats: overall,
        topicStats: { [key]: topic },
        ratingCount: overall.n,
        // The headline star rating is the mean of the three things students are asked about.
        rating: Math.round(((overall.explain + overall.depth + overall.solving) / (3 * overall.n)) * 10) / 10,
      },
      { merge: true }
    );
    return true;
  });
}

/** Counts a finished live session toward the teacher's record for its topic (and their total). */
export async function recordSessionCompleted(teacherId: string, topic: string, subtopic?: string): Promise<void> {
  const teacherRef = doc(db, "teachers", teacherId);
  await runTransaction(db, async (tx) => {
    const teacher = await readTeacher(tx, teacherRef);
    if (!teacher) return;
    const key = statKey(topic, subtopic);
    const prev: TopicStat = teacher.topicStats?.[key] ?? { ...empty(), name: canonicalSubject(topic, subtopic) ?? topic, sessions: 0 };
    tx.set(
      teacherRef,
      { doubtsResolved: (teacher.doubtsResolved || 0) + 1, topicStats: { [key]: { ...prev, sessions: prev.sessions + 1 } } },
      { merge: true }
    );
  });
}
