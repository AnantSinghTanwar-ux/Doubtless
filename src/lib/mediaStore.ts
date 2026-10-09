import { collection, doc, getDoc, getDocs, orderBy, query, setDoc } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Durable file storage on top of Firestore, for hosts with no persistent disk (e.g. Vercel).
 * Each file is split into ~480 KB chunks stored as base64 under verificationMedia/{uid}__{key}/chunks.
 * The metadata doc is written last, so a half-finished upload is never visible.
 * Works in the browser (user's own upload) and on the server (reading for review / profile photo).
 */
const CHUNK_BYTES = 480 * 1024;
const COLLECTION = "verificationMedia";

export interface MediaMeta {
  uid: string;
  key: string;
  contentType: string;
  size: number;
  chunks: number;
  createdAt: number;
}

const mediaId = (uid: string, key: string) => {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid) || !/^[A-Za-z0-9_-]{1,64}$/.test(key)) throw new Error("Invalid media id");
  return `${uid}__${key}`;
};

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function chunkCount(size: number) {
  return Math.max(1, Math.ceil(size / CHUNK_BYTES));
}

export async function uploadMedia(uid: string, key: string, blob: Blob, onChunk?: () => void): Promise<void> {
  const id = mediaId(uid, key);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const total = chunkCount(bytes.length);
  const indexes = Array.from({ length: total }, (_, i) => i);

  // A few chunks in flight at once keeps the upload quick without hammering Firestore.
  const workers = Array.from({ length: Math.min(8, total) }, async () => {
    for (let i = indexes.shift(); i !== undefined; i = indexes.shift()) {
      const slice = bytes.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES);
      await setDoc(doc(db, COLLECTION, id, "chunks", String(i).padStart(4, "0")), { i, data: bytesToBase64(slice) });
      onChunk?.();
    }
  });
  await Promise.all(workers);

  const meta: MediaMeta = { uid, key, contentType: blob.type || "application/octet-stream", size: bytes.length, chunks: total, createdAt: Date.now() };
  await setDoc(doc(db, COLLECTION, id), meta);
}

export async function getMediaMeta(uid: string, key: string): Promise<MediaMeta | null> {
  const snap = await getDoc(doc(db, COLLECTION, mediaId(uid, key)));
  return snap.exists() ? (snap.data() as MediaMeta) : null;
}

async function getChunk(uid: string, key: string, index: number): Promise<Uint8Array> {
  const snap = await getDoc(doc(db, COLLECTION, mediaId(uid, key), "chunks", String(index).padStart(4, "0")));
  if (!snap.exists()) throw new Error("Media chunk missing");
  return base64ToBytes(snap.data().data as string);
}

/** Whole file in memory; fine for images and for the AI screening step. */
export async function readMedia(uid: string, key: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const meta = await getMediaMeta(uid, key);
  if (!meta) return null;
  const snap = await getDocs(query(collection(db, COLLECTION, mediaId(uid, key), "chunks"), orderBy("i", "asc")));
  const parts = snap.docs.slice(0, meta.chunks).map((d) => base64ToBytes(d.data().data as string));
  const bytes = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    bytes.set(p, offset);
    offset += p.length;
  }
  return { bytes, contentType: meta.contentType };
}

/** Streams a file chunk by chunk so large videos aren't bound by serverless response size limits. */
export function streamMedia(meta: MediaMeta): ReadableStream<Uint8Array> {
  let next = 0;
  return new ReadableStream({
    async pull(controller) {
      if (next >= meta.chunks) return controller.close();
      try {
        controller.enqueue(await getChunk(meta.uid, meta.key, next++));
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
