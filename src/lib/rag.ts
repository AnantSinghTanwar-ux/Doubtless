import type { RetrievedChunk, VaultChunk } from "@/types";

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

export function retrieveTopChunks(
  queryEmbedding: number[],
  chunks: VaultChunk[],
  fileName: string,
  topK: number = 5
): RetrievedChunk[] {
  const scored = chunks.map((chunk) => ({
    text: chunk.text,
    pageNumber: chunk.pageNumber,
    fileName,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
