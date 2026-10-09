import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Saved CoWork results (page notes, highlights, study guide) so a document is analysed once, not every visit.
 * Shared across devices and reloads; kept for COWORK_CACHE_HOURS (default 7 days) or until the student presses refresh.
 * One small document per page (about 3-6 KB) and one per study guide (about 20-60 KB).
 */
const COLLECTION = "coworkCache";
/** Bump when the shape or quality of stored results changes, so old entries are ignored. */
export const COWORK_CACHE_VERSION = 5;
const TTL_MS = (Number(process.env.NEXT_PUBLIC_COWORK_CACHE_HOURS) || 168) * 3_600_000;

export const pageCacheId = (vaultId: string, page: number) => `${vaultId}__p${page}`;
export const overviewCacheId = (vaultId: string) => `${vaultId}__overview`;

export async function readCowork<T>(id: string): Promise<T | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    const d = snap.data() as { data: T; createdAt: number; version: number };
    if (d.version !== COWORK_CACHE_VERSION || Date.now() - d.createdAt > TTL_MS) return null;
    return d.data;
  } catch {
    return null; // a cache must never break the feature
  }
}

/** Every saved page of a document in one query (one read per page), so reopening a document shows all its notes at once. */
export async function readAllPages<T>(vaultId: string): Promise<Map<number, T>> {
  const out = new Map<number, T>();
  try {
    const snap = await getDocs(query(collection(db, COLLECTION), where("vaultId", "==", vaultId)));
    for (const d of snap.docs) {
      const v = d.data() as { data: T; createdAt: number; version: number; page?: number };
      if (typeof v.page === "number" && v.version === COWORK_CACHE_VERSION && Date.now() - v.createdAt <= TTL_MS) out.set(v.page, v.data);
    }
  } catch {
    /* fall back to per-page reads */
  }
  return out;
}

/** `where` (vaultId, page) is stored for page entries so readAllPages can find them. */
export async function writeCowork(id: string, data: unknown, where_?: { vaultId: string; page?: number }): Promise<void> {
  try {
    await setDoc(doc(db, COLLECTION, id), { data, createdAt: Date.now(), version: COWORK_CACHE_VERSION, ...(where_ ?? {}) });
  } catch (err) {
    console.warn("[coworkCache] could not save:", err instanceof Error ? err.message : err);
  }
}
