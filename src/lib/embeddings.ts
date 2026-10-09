import { embedText } from "./aiProvider";
import { getVaultChunks, getVaultDocuments } from "./firestore";
import { retrieveTopChunks } from "./rag";
import type { RetrievedChunk } from "@/types";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import type { VaultDocument, VaultChunk } from "@/types";

/** Chunks indexed by different models have different vector lengths; embed the question once per length and merge the results. */
async function retrieveByModel(question: string, chunks: VaultChunk[], fileName: string, topK: number): Promise<RetrievedChunk[]> {
  const dims = [...new Set(chunks.map((c) => c.embedding?.length ?? 0).filter(Boolean))];
  if (dims.length === 0) return [];
  const groups = await Promise.all(
    dims.map(async (dim) => retrieveTopChunks(await embedText(question, dim), chunks.filter((c) => c.embedding?.length === dim), fileName, topK))
  );
  return groups.flat().sort((a, b) => b.score - a.score).slice(0, topK);
}

/*
 * A document's chunks never change after upload, so a server keeps them in memory for a while. Without this every
 * question re-reads every chunk from Firestore (one read per chunk), which is what would exhaust a free daily quota.
 */
const CHUNK_TTL_MS = 30 * 60_000;
const chunkCache = new Map<string, { at: number; chunks: VaultChunk[] }>();

async function cachedChunks(vaultId: string): Promise<VaultChunk[]> {
  const hit = chunkCache.get(vaultId);
  if (hit && Date.now() - hit.at < CHUNK_TTL_MS) return hit.chunks;
  const chunks = await getVaultChunks(vaultId);
  if (chunkCache.size >= 60) chunkCache.delete(chunkCache.keys().next().value!); // oldest first
  chunkCache.set(vaultId, { at: Date.now(), chunks });
  return chunks;
}

export async function searchVault(
  query: string,
  vaultId: string,
  fileName: string,
  topK: number = 5
): Promise<RetrievedChunk[]> {
  const chunks = await cachedChunks(vaultId);
  return retrieveByModel(query, chunks, fileName, topK);
}

const MIN_SCORE: Record<number, number> = { 768: 0.55, 2048: 0.25 };

/**
 * Searches all of a student's uploaded notes, not just the open one: the selected document plus their most recent
 * uploads (capped, to bound reads). Results from the selected document get a small boost so it stays the main source.
 */
export async function searchUserVaults(
  question: string,
  userId: string,
  opts: { preferVaultId?: string; topK?: number; maxVaults?: number; minScore?: number } = {}
): Promise<RetrievedChunk[]> {
  const { preferVaultId, topK = 5, maxVaults = 6 } = opts;
  const docs = (await getVaultDocuments(userId)).sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0));
  const chosen = [...docs.filter((d) => d.id === preferVaultId), ...docs.filter((d) => d.id !== preferVaultId)].slice(0, maxVaults);
  if (!chosen.length) return [];

  const loaded = await Promise.all(chosen.map(async (d) => ({ d, chunks: await cachedChunks(d.id).catch(() => [] as VaultChunk[]) })));
  // Embed the question once per embedding model in use, then score every chunk.
  const dims = [...new Set(loaded.flatMap(({ chunks }) => chunks.map((c) => c.embedding?.length ?? 0)).filter(Boolean))];
  const queries = new Map(await Promise.all(dims.map(async (dim) => [dim, await embedText(question, dim).catch(() => null)] as const)));
  const scored = loaded.flatMap(({ d, chunks }) =>
    chunks.flatMap((c) => {
      const q = queries.get(c.embedding?.length ?? 0);
      if (!q) return [];
      const [hit] = retrieveTopChunks(q, [c], d.fileName, 1);
      return [{ ...hit, dim: q.length, score: hit.score + (d.id === preferVaultId ? 0.05 : 0) }];
    })
  );
  // Each embedding model scores on its own scale; below these a passage is usually off-topic (measured on study notes).
  const minFor = (c: RetrievedChunk & { dim?: number }) => opts.minScore ?? MIN_SCORE[c.dim ?? 0] ?? 0.3;
  return scored.filter((c) => c.score >= minFor(c)).sort((a, b) => b.score - a.score).slice(0, topK).map((c) => ({ text: c.text, pageNumber: c.pageNumber, fileName: c.fileName, score: c.score }));
}

export async function searchFolderPastPapers(
  textQuery: string,
  folderId: string,
  topK: number = 3
): Promise<RetrievedChunk[]> {
  // 1. Get all documents in this folder that are of type 'paper'
  const docsQuery = query(
    collection(db, "vaults"),
    where("folderId", "==", folderId),
    where("type", "==", "paper")
  );
  
  const snap = await getDocs(docsQuery);
  const paperDocs = snap.docs.map(d => ({ id: d.id, ...d.data() } as VaultDocument));
  
  if (paperDocs.length === 0) return [];

  // 2. Fetch all chunks for all these paper docs
  let allChunks: VaultChunk[] = [];
  const fileNameMap = new Map<string, string>();
  
  for (const doc of paperDocs) {
    fileNameMap.set(doc.id, doc.fileName);
    const chunks = await getVaultChunks(doc.id);
    allChunks = allChunks.concat(chunks);
  }
  
  // 3. Retrieve top chunks based on the query text
  const topChunks = await retrieveByModel(textQuery, allChunks, "Past Papers", topK);
  
  // Correct the filenames
  return topChunks.map(c => {
    // We hackily mapped the "fileName" parameter in retrieveTopChunks.
    // Instead we'll just return it.
    return c; 
  });
}

/** Raw text of every past paper in a folder, for topic-level PYQ generation. */
export async function getFolderPastPaperText(folderId: string, maxChars = 20000): Promise<string> {
  const snap = await getDocs(
    query(collection(db, "vaults"), where("folderId", "==", folderId), where("type", "==", "paper"))
  );
  let out = "";
  for (const d of snap.docs) {
    const chunks = (await getVaultChunks(d.id)).sort((a, b) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0));
    out += `\n\n=== ${(d.data() as VaultDocument).fileName} ===\n` + chunks.map((c) => c.text).join("\n");
    if (out.length >= maxChars) break;
  }
  return out.slice(0, maxChars).trim();
}

export function formatChunksForPrompt(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "No reference material available. Use general knowledge.";

  return chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}: ${c.fileName}, Page ${c.pageNumber}, Relevance: ${(c.score * 100).toFixed(1)}%]\n${c.text}`
    )
    .join("\n\n");
}
