// Client-only helpers around pdf.js. Always import this module dynamically
// (pdf.js touches browser globals at import time).
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export type { PDFDocumentProxy, PDFPageProxy };

export function loadPdfFromData(data: Uint8Array): Promise<PDFDocumentProxy> {
  return pdfjs.getDocument({ data }).promise;
}

export function loadPdf(url: string, httpHeaders?: Record<string, string>): Promise<PDFDocumentProxy> {
  return pdfjs.getDocument({ url, httpHeaders }).promise;
}

/** The page's text layer, one line per visual line. Empty for scanned or outlined-text PDFs. */
export async function extractPageText(page: PDFPageProxy): Promise<string> {
  const content = await page.getTextContent();
  let text = "";
  let lastY: number | null = null;
  for (const item of content.items) {
    if (!("str" in item)) continue;
    const y = item.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 1) text += "\n";
    text += item.str;
    lastY = y;
  }
  return text.trim();
}

/** Renders a page to a JPEG data URL (for sending to a vision model). */
export async function renderPageImage(page: PDFPageProxy, width: number, quality = 0.8): Promise<string> {
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / base.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const url = canvas.toDataURL("image/jpeg", quality);
  canvas.width = canvas.height = 0;
  return url;
}

const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * Finds a quoted phrase in the page's text layer and returns its position as [ymin, xmin, ymax, xmax] on a 0-1000
 * scale (top-left origin), or null if the phrase isn't there. Positions come from the PDF itself, so they are exact,
 * unlike coordinates an AI model guesses from a picture of the page.
 */
export async function locateQuote(page: PDFPageProxy, quote: string): Promise<[number, number, number, number] | null> {
  const target = squash(quote);
  if (target.length < 6) return null;

  const content = await page.getTextContent();
  type Run = { norm: string; start: number; x: number; y: number; w: number; h: number };
  const runs: Run[] = [];
  let all = "";
  for (const item of content.items) {
    if (!("str" in item)) continue;
    const norm = squash(item.str);
    if (!norm) continue;
    runs.push({ norm, start: all.length, x: item.transform[4], y: item.transform[5], w: item.width, h: item.height || Math.abs(item.transform[3]) });
    all += norm;
  }

  // Try the whole quote, then shorter leading pieces in case the model reworded the tail.
  let idx = -1;
  let len = target.length;
  for (const n of [target.length, 40, 24, 14]) {
    if (n > target.length) continue;
    const probe = target.slice(0, n);
    idx = all.indexOf(probe);
    if (idx >= 0) {
      len = probe.length;
      break;
    }
  }
  if (idx < 0) return null;

  const hit = runs.filter((r) => r.start < idx + len && r.start + r.norm.length > idx);
  if (!hit.length) return null;
  const sameLine = hit.every((r) => Math.abs(r.y - hit[0].y) < Math.max(2, hit[0].h * 0.5));

  let x1 = Infinity;
  let x2 = -Infinity;
  let y1 = Infinity;
  let y2 = -Infinity;
  for (const r of hit) {
    // On a single line, trim the first and last runs to the characters actually quoted.
    const from = sameLine ? Math.max(0, idx - r.start) / r.norm.length : 0;
    const to = sameLine ? Math.min(r.norm.length, idx + len - r.start) / r.norm.length : 1;
    x1 = Math.min(x1, r.x + r.w * from);
    x2 = Math.max(x2, r.x + r.w * to);
    y1 = Math.min(y1, r.y - r.h * 0.2);
    y2 = Math.max(y2, r.y + r.h * 0.95);
  }

  const viewport = page.getViewport({ scale: 1 });
  const [ax, ay, bx, by] = viewport.convertToViewportRectangle([x1, y1, x2, y2]);
  // Breathing room around the words; a bit more sideways, since where a quote ends inside a line is an estimate.
  const padY = 0.6;
  const padX = 4;
  const n = (v: number, size: number) => Math.min(1000, Math.max(0, Math.round((v / size) * 1000)));
  return [
    n(Math.min(ay, by) - padY, viewport.height),
    n(Math.min(ax, bx) - padX, viewport.width),
    n(Math.max(ay, by) + padY, viewport.height),
    n(Math.max(ax, bx) + padX, viewport.width),
  ];
}

/* ------------------------------------------------------------------ */
/* OCR for pages with no text layer (scanned PDFs, slides exported as   */
/* pictures). Gives the words AND where they sit, so highlights can be  */
/* placed exactly even when the PDF itself has no text.                */
/* ------------------------------------------------------------------ */

export interface OcrWord {
  text: string;
  /** [ymin, xmin, ymax, xmax] on a 0-1000 scale, same as text-layer boxes. */
  box: [number, number, number, number];
  line: number;
}

export interface OcrPage {
  text: string;
  words: OcrWord[];
}

type TesseractWorker = { recognize: (img: HTMLCanvasElement, opts?: object, out?: object) => Promise<{ data: { text: string; blocks: { paragraphs: { lines: { words: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }[] }[] }[] | null } }> };
let ocrWorker: Promise<TesseractWorker> | null = null;

/** One shared OCR worker, created on first use (it downloads its English model once, then the browser caches it). */
function getOcrWorker(): Promise<TesseractWorker> {
  if (!ocrWorker) {
    ocrWorker = import("tesseract.js").then(({ createWorker }) => createWorker("eng") as unknown as Promise<TesseractWorker>);
    ocrWorker.catch(() => (ocrWorker = null));
  }
  return ocrWorker;
}

/** Reads a page with OCR. Renders it at ~1600 px wide, which keeps small slide text legible. */
export async function ocrPage(page: PDFPageProxy): Promise<OcrPage> {
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 1600 / base.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  const worker = await getOcrWorker();
  const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
  const W = canvas.width;
  const H = canvas.height;
  const words: OcrWord[] = [];
  let line = 0;
  for (const block of data.blocks ?? [])
    for (const para of block.paragraphs)
      for (const l of para.lines) {
        for (const w of l.words) {
          if (!w.text.trim()) continue;
          const b = w.bbox;
          words.push({ text: w.text, line, box: [Math.round((b.y0 / H) * 1000), Math.round((b.x0 / W) * 1000), Math.round((b.y1 / H) * 1000), Math.round((b.x1 / W) * 1000)] });
        }
        line++;
      }
  return { text: data.text.trim(), words };
}

/** Finds a quoted phrase among OCR words and returns the box around it (null if it is not on the page). */
export function locateQuoteInWords(words: OcrWord[], quote: string): [number, number, number, number] | null {
  const target = squash(quote);
  if (target.length < 6 || words.length === 0) return null;
  let all = "";
  const runs = words.map((w) => {
    const norm = squash(w.text);
    const r = { w, start: all.length, norm };
    all += norm;
    return r;
  });
  let idx = -1;
  let len = target.length;
  for (const n of [target.length, 40, 24, 14]) {
    if (n > target.length) continue;
    idx = all.indexOf(target.slice(0, n));
    if (idx >= 0) {
      len = n;
      break;
    }
  }
  if (idx < 0) return null;
  const hit = runs.filter((r) => r.norm && r.start < idx + len && r.start + r.norm.length > idx).map((r) => r.w);
  if (!hit.length) return null;
  // Keep the box to the line the quote starts on, so a phrase that wraps doesn't paint a big block.
  const firstLine = hit[0].line;
  const sameLine = hit.filter((w) => w.line === firstLine);
  const pad = 4;
  return [
    Math.max(0, Math.min(...sameLine.map((w) => w.box[0])) - pad),
    Math.max(0, Math.min(...sameLine.map((w) => w.box[1])) - pad),
    Math.min(1000, Math.max(...sameLine.map((w) => w.box[2])) + pad),
    Math.min(1000, Math.max(...sameLine.map((w) => w.box[3])) + pad),
  ];
}
