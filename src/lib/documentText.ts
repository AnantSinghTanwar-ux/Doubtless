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

/** Text of every page of a PDF, read in the browser (so the file never has to pass through the server). */
async function pdfPages(file: File): Promise<PageText[]> {
  const lib = await import("./pdfClient");
  const doc = await lib.loadPdfFromData(new Uint8Array(await file.arrayBuffer()));
  const out: PageText[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const text = await lib.extractPageText(await doc.getPage(n));
    if (text) out.push({ pageNumber: n, text });
  }
  return out;
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

export async function extractDocumentPages(file: File, kind: DocKind): Promise<{ pages: PageText[]; pageCount: number }> {
  if (kind === "pptx") {
    const pages = await pptxPages(file);
    return { pages, pageCount: Math.max(pages.at(-1)?.pageNumber ?? 0, pages.length) };
  }
  const pages = await pdfPages(file);
  return { pages, pageCount: Math.max(pages.at(-1)?.pageNumber ?? 0, pages.length) };
}
