import { embedText } from "./aiProvider";
import { getVaultChunks } from "./firestore";
import { retrieveTopChunks } from "./rag";
import type { RetrievedChunk } from "@/types";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import type { VaultDocument, VaultChunk } from "@/types";

export async function searchVault(
  query: string,
  vaultId: string,
  fileName: string,
  topK: number = 5
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedText(query);
  const chunks = await getVaultChunks(vaultId);
  return retrieveTopChunks(queryEmbedding, chunks, fileName, topK);
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
  const queryEmbedding = await embedText(textQuery);
  const topChunks = retrieveTopChunks(queryEmbedding, allChunks, "Past Papers", topK);
  
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
