// Client-only helpers around pdf.js. Always import this module dynamically
// (pdf.js touches browser globals at import time).
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export type { PDFDocumentProxy, PDFPageProxy };

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
