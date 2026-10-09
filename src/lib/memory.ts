import { arrayUnion, collection, deleteDoc, doc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase";
import { embedText, embedTexts } from "./aiProvider";
import { canonicalSubject } from "./teacherRanking";
import { cosineSimilarity } from "./rag";

/**
 * Study memory: a student's own past doubts, teacher sessions and vivas, embedded so a new question can be matched to
 * what they asked before ("you were stuck on the chain rule last week; here's how that connects").
 *
 * Stored as a few shard documents per student (memories/{uid}__{n}, up to 40 entries each), so recalling everything costs
 * about 3 Firestore reads instead of one read per memory. The newest 200 memories are kept.
 */
export type MemoryKind = "doubt" | "session" | "viva" | "practice";

export interface Memory {
  kind: MemoryKind;
  topic: string;
  /** The question or moment, in the student's words. */
  text: string;
  /** What helped, or what the outcome was. */
  takeaway: string;
  at: number;
  embedding: number[];
}

export interface RecalledMemory extends Omit<Memory, "embedding"> {
  score: number;
}

const PER_SHARD = 40;
const MAX_SHARDS = 5;

interface Shard {
  id: string;
  uid: string;
  seq: number;
  items: Memory[];
}

async function shards(uid: string): Promise<Shard[]> {
  const snap = await getDocs(query(collection(db, "memories"), where("uid", "==", uid)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Shard, "id">) })).sort((a, b) => a.seq - b.seq);
}

/** Saves one memory. Best-effort: a failure here must never break the feature that called it. */
export async function remember(uid: string, m: Omit<Memory, "embedding" | "at">): Promise<void> {
  if (!uid || uid === "anonymous" || !m.text.trim()) return;
  try {
    // Stored like a document passage, so it is searched the same way notes are.
    const [embedding] = await embedTexts([`${m.topic}\n${m.text}\n${m.takeaway}`.slice(0, 2000)]);
    const item: Memory = { ...m, text: m.text.slice(0, 500), takeaway: m.takeaway.slice(0, 600), at: Date.now(), embedding };
    const all = await shards(uid);
    const last = all[all.length - 1];
    if (last && last.items.length < PER_SHARD) {
      await updateDoc(doc(db, "memories", last.id), { items: arrayUnion(item) });
      return;
    }
    const seq = (last?.seq ?? -1) + 1;
    await setDoc(doc(db, "memories", `${uid}__${seq}`), { uid, seq, items: [item] });
    // Keep the newest MAX_SHARDS shards.
    for (const old of all.slice(0, Math.max(0, all.length + 1 - MAX_SHARDS))) await deleteDoc(doc(db, "memories", old.id));
  } catch (err) {
    console.warn("[memory] could not save:", err instanceof Error ? err.message : err);
  }
}

/*
 * How similar a past moment must be to count as related. Embedding models score on different scales; these were
 * measured on related vs unrelated study questions (NVIDIA nemotron: related 0.30-0.58, unrelated 0.10-0.22;
 * nomic-embed-text: related 0.55-0.71, unrelated 0.40-0.55).
 */
const MIN_SCORE: Record<number, number> = { 2048: 0.28, 768: 0.55 };

/**
 * The student's past moments most related to a new question. Qualifying the question with its routed topic makes the
 * match far more reliable, and a memory from a different subject never counts (physics history for a maths doubt).
 */
export async function recall(uid: string, question: string, opts: { topic?: string; k?: number } = {}): Promise<RecalledMemory[]> {
  const { topic = "", k = 3 } = opts;
  if (!uid || uid === "anonymous" || !question.trim()) return [];
  try {
    const items = (await shards(uid)).flatMap((s) => s.items);
    if (!items.length) return [];
    const subject = canonicalSubject(topic, question);
    const sameSubject = items.filter((m) => !subject || (canonicalSubject(m.topic, m.text) ?? subject) === subject);
    // A memory can only be compared with a question embedded by the same model (same vector length).
    const byDim = new Map<number, Memory[]>();
    for (const m of sameSubject) if (m.embedding?.length) byDim.set(m.embedding.length, [...(byDim.get(m.embedding.length) ?? []), m]);
    const scored: RecalledMemory[] = [];
    for (const [dim, list] of byDim) {
      const q = await embedText(`${topic}\n${question}`.trim(), dim).catch(() => null);
      if (!q || q.length !== dim) continue;
      const min = MIN_SCORE[dim] ?? 0.5;
      for (const { embedding, ...rest } of list) {
        const score = cosineSimilarity(q, embedding);
        if (score >= min) scored.push({ ...rest, score });
      }
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, k);
  } catch (err) {
    console.warn("[memory] recall failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

export function formatMemoriesForPrompt(memories: Pick<RecalledMemory, "kind" | "topic" | "text" | "takeaway" | "at">[]): string {
  if (!memories.length) return "";
  return memories
    .map((m) => `- ${new Date(m.at).toISOString().slice(0, 10)}, ${m.kind} on ${m.topic}: "${m.text}"${m.takeaway ? ` -> ${m.takeaway}` : ""}`)
    .join("\n");
}
