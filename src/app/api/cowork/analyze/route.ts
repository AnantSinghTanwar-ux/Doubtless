import { withUsage } from "@/lib/usage";
import { NextRequest, NextResponse } from "next/server";
import { openRouterJSON, type OpenRouterContent } from "@/lib/aiProvider";
import { nvidiaConfigured, nvidiaDescribePage } from "@/lib/nvidia";
import type { HighlightKind, PageAnalysis, PageHighlight } from "@/types/cowork";

const systemPrompt = `You are an AI study partner in "CoWork" mode. A student preparing for university exams is reading ONE page of a lecture PDF. You are given the page's text layer when it has one, and otherwise an image of the page.

Return ONLY a JSON object:
{
  "hasContent": boolean,          // false for title slides, "thank you" slides, blank or index pages
  "title": string,                // topic of this page, max 8 words
  "summary": string,              // 2-4 sentence plain-language explanation. Markdown **bold** allowed. No LaTeX, no tables.
  "keyPoints": string[],          // 2-5 crisp facts / definitions from this page
  "formulas": [{ "name": string, "formula": string, "note": string }],  // every formula, notation or rule on the page; [] if none
  "practice": [{ "question": string, "options": [4 strings without "A)" prefixes], "answer": 0-3, "explanation": string }],  // 1-2 MCQs; [] if no content
  "examTip": string,              // one line on how this is asked in exams, or "" if not examinable
  "highlights": [{ "quote": string, "kind": "important" | "definition" | "formula" | "keyword", "label": string }]
}

Highlights mark where on the page the student should look. Rules:
- quote: copy 4-14 consecutive words EXACTLY as they appear in the text layer (same spelling and order, from a single line or sentence). Never invent, reword or merge text, and never quote anything that is not in the text layer.
- If only OCR text or a reading of the page image is supplied, still quote the words exactly as they appear in that text. Never give coordinates.
- 2-5 highlights for content pages, [] otherwise. Pick different parts of the page. Never highlight the logo, header bar or page number.
- "important" = most likely to be asked in exams (use for at most 2), "definition" = a definition, "formula" = an equation or notation, "keyword" = a key term.
- label: 1-4 words shown next to the highlight, e.g. "Exam favourite", "Definition", "Remember this", "Key formula".

Write all math with Unicode (∈, ∉, ⊆, ∪, ∩, ≠, ≤, ², √, Σ, →), never LaTeX. Never use HTML tags such as <br>; plain text and Markdown only. Everything you write must come from this page, not from other topics.`;

const KINDS: HighlightKind[] = ["important", "definition", "formula", "keyword"];

const overlaps = (a: number[], b: number[]) => {
  const w = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  const h = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
  return w > 0 && h > 0 && w * h > 0.2 * Math.min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]));
};

/**
 * Keeps highlights that are plausible. Quoted ones are positioned later in the browser from the PDF's own text layer.
 * Model-drawn boxes are only trusted when they look like a line of text: not huge, not in the header band, not overlapping.
 */
function cleanHighlights(raw: unknown): PageHighlight[] {
  if (!Array.isArray(raw)) return [];
  const out: PageHighlight[] = [];
  for (const h of raw) {
    if (!h || typeof h !== "object") continue;
    const kind: HighlightKind = KINDS.includes(h.kind) ? h.kind : "keyword";
    const label = typeof h.label === "string" ? h.label.slice(0, 32) : "";
    if (typeof h.quote === "string" && h.quote.trim().length >= 6) {
      out.push({ box: [0, 0, 0, 0], quote: h.quote.trim().slice(0, 200), kind, label });
      continue;
    }
    if (Array.isArray(h.box) && h.box.length === 4 && h.box.every((n: unknown) => typeof n === "number")) {
      const [y1, x1, y2, x2] = (h.box as number[]).map((n) => Math.min(1000, Math.max(0, n)));
      const box = [Math.min(y1, y2), Math.min(x1, x2), Math.max(y1, y2), Math.max(x1, x2)] as PageHighlight["box"];
      const height = box[2] - box[0];
      const width = box[3] - box[1];
      if (height < 8 || width < 20 || height > 220 || height * width > 110_000 || box[0] < 60) continue;
      if (out.some((o) => o.box[2] > o.box[0] && overlaps(o.box, box))) continue;
      out.push({ box, kind, label });
    }
  }
  return out.slice(0, 6);
}

/** AI calls can take a while; give them room on serverless hosts. */
export const maxDuration = 300;

async function handlePost(request: NextRequest) {
  try {
    const { image, text: layerText, ocrText, fast } = await request.json();
    const layer = typeof layerText === "string" ? layerText : "";
    // Scanned pages have no text layer; the browser OCRs them and sends that text, which we use for exact quotes.
    const ocr = typeof ocrText === "string" ? ocrText.trim() : "";

    // Pages with a real text layer are analysed from that text: it is exact, cheap, and lets a strong text model do the
    // reasoning. Scanned pages send the picture (it reads formulas far better than OCR) plus the OCR text for quoting.
    // Pages read in the background ("fast") use the OCR text alone when there is enough of it: much quicker on a local model.
    const useOcrAsText = !!fast && ocr.length >= 200 && layer.trim().length < 120;
    const hasText = layer.trim().length >= 120 || useOcrAsText;
    if (!hasText && (typeof image !== "string" || !image.startsWith("data:image/"))) {
      return NextResponse.json({ error: "A page image is required" }, { status: 400 });
    }
    const content: OpenRouterContent[] = hasText ? [] : [{ type: "image_url", image_url: { url: image } }];
    if (useOcrAsText) content.push({ type: "text", text: `Text of this page (read by OCR, may contain small errors; quote highlights from it word for word):\n${ocr.slice(0, 6000)}` });
    else if (layer.trim()) content.push({ type: "text", text: `Text layer of this page:\n${layer.slice(0, 8000)}` });
    if (!hasText && ocr) {
      content.push({ type: "text", text: `Text recognised on this page by OCR (may contain small errors; quote highlights from it word for word):\n${ocr.slice(0, 6000)}` });
    }
    content.push({ type: "text", text: "Analyze this page." });

    const analyse = (c: OpenRouterContent[]) => openRouterJSON<Partial<PageAnalysis>>({ system: systemPrompt, content: c, maxTokens: 3000 });

    // Picture-only pages on NVIDIA: a vision model reads the page into text first, then the text model analyses it.
    // Highlights are quoted from the OCR text when there is one; the browser places them.
    const readThenAnalyse = async () => {
      const described = await nvidiaDescribePage(image);
      const analysis = await analyse([
        { type: "text", text: `Text read from the page image:\n${described.slice(0, 8000)}` },
        ...(ocr ? [{ type: "text" as const, text: `Text recognised on this page by OCR (quote highlights from it word for word):\n${ocr.slice(0, 6000)}` }] : []),
        { type: "text", text: ocr ? "Analyze this page." : 'Analyze this page. Return "highlights": [].' },
      ]);
      return ocr ? analysis : { ...analysis, highlights: [] };
    };

    let raw: Partial<PageAnalysis>;
    if (!hasText && nvidiaConfigured() && process.env.AI_PROVIDER === "nvidia") {
      raw = await readThenAnalyse();
    } else {
      try {
        raw = await analyse(content);
      } catch (err) {
        if (hasText || !nvidiaConfigured()) throw err;
        console.warn("[cowork] image analysis failed, reading the page into text instead:", err instanceof Error ? err.message : err);
        raw = await readThenAnalyse();
      }
    }

    // A cold or small local model sometimes returns valid JSON with nothing in it; ask once more before showing an empty page.
    const isEmpty = (r: Partial<PageAnalysis>) => r.hasContent !== false && !(typeof r.title === "string" && r.title.trim()) && !(typeof r.summary === "string" && r.summary.trim());
    if (isEmpty(raw)) {
      try {
        raw = await analyse(content);
      } catch {
        /* keep the first answer */
      }
    }

    const result: PageAnalysis = {
      hasContent: raw.hasContent !== false,
      title: typeof raw.title === "string" ? raw.title : "",
      summary: typeof raw.summary === "string" ? raw.summary : "",
      keyPoints: Array.isArray(raw.keyPoints) ? raw.keyPoints.filter((k) => typeof k === "string") : [],
      formulas: Array.isArray(raw.formulas) ? raw.formulas.filter((f) => f && typeof f.formula === "string") : [],
      practice: Array.isArray(raw.practice)
        ? raw.practice.filter(
            (q) => q && typeof q.question === "string" && Array.isArray(q.options) && q.options.length >= 2 && typeof q.answer === "number"
          )
        : [],
      examTip: typeof raw.examTip === "string" ? raw.examTip : "",
      highlights: cleanHighlights(raw.highlights),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("CoWork analyze error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze page" },
      { status: 500 }
    );
  }
}

/** Tracks the AI cost of each request (see src/lib/usage.ts). */
export const POST = withUsage("cowork.page", handlePost);
