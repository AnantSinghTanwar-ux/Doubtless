"use client";

export interface PageText {
  pageNumber: number;
  text: string;
}

export const MAX_UPLOAD_MB = 40;
export type DocKind = "pdf" | "pptx";

export function docKind(file: File): DocKind | null {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".pptx") || file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return "pptx";
  return null;
}

/** Scanned pages are read with OCR, at a few seconds a page; past this many the rest are skipped to keep uploads bounded. */
const MAX_OCR_PAGES = 150;

/**
 * Text of every page of a PDF, read in the browser (so the file never has to pass through the server). Pages with no
 * text layer (scans, slides exported as pictures, phone photos of notes) are read with OCR, so they can be searched too.
 */
async function pdfPages(file: File, onProgress?: (msg: string) => void): Promise<{ pages: PageText[]; pageCount: number }> {
  const lib = await import("./pdfClient");
  const doc = await lib.loadPdfFromData(new Uint8Array(await file.arrayBuffer()));
  const out: PageText[] = [];
  let ocrDone = 0;
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    let text = await lib.extractPageText(page);
    if (text.trim().length < 40 && ocrDone < MAX_OCR_PAGES) {
      onProgress?.(`Reading scanned page ${n} of ${doc.numPages}…`);
      text = (await lib.ocrPage(page).catch(() => null))?.text ?? text;
      ocrDone++;
    }
    if (text.trim()) out.push({ pageNumber: n, text });
  }
  return { pages: out, pageCount: doc.numPages };
}

const decode = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** Text of every slide of a .pptx (a zip of XML), one page per slide. Paragraph breaks are kept. */
async function pptxPages(file: File): Promise<PageText[]> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slides = Object.keys(zip.files)
    .map((name) => ({ name, n: Number(name.match(/^ppt\/slides\/slide(\d+)\.xml$/)?.[1]) }))
    .filter((s) => s.n)
    .sort((a, b) => a.n - b.n);
  const out: PageText[] = [];
  for (const [i, s] of slides.entries()) {
    const xml = await zip.files[s.name].async("string");
    const paragraphs = xml.match(/<a:p[ >][\s\S]*?<\/a:p>/g) ?? [];
    const text = paragraphs
      .map((p) => decode([...p.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]).join("")).trim())
      .filter(Boolean)
      .join("\n");
    if (text) out.push({ pageNumber: i + 1, text });
  }
  return out;
}

export async function extractDocumentPages(file: File, kind: DocKind, onProgress?: (msg: string) => void): Promise<{ pages: PageText[]; pageCount: number }> {
  if (kind === "pptx") {
    const pages = await pptxPages(file);
    return { pages, pageCount: Math.max(pages.at(-1)?.pageNumber ?? 0, pages.length) };
  }
  return pdfPages(file, onProgress);
}
