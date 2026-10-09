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
- If NO text layer is supplied (you only have an image), use "box": [ymin, xmin, ymax, xmax] instead of "quote": a tight box around one line of words, normalized 0-1000. Only give a box if you are certain where the words are; otherwise return no highlights.
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
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { image, text } = await request.json();
    if (typeof image !== "string" || !image.startsWith("data:image/")) {
      return NextResponse.json({ error: "A page image is required" }, { status: 400 });
    }

    // Pages with a real text layer are analysed from that text: it is exact, cheap, and lets a strong text model do the
    // reasoning. The picture is only for scanned or vector-drawn pages that have little or no text.
    const hasText = typeof text === "string" && text.trim().length >= 120;
    const content: OpenRouterContent[] = hasText ? [] : [{ type: "image_url", image_url: { url: image } }];
    if (typeof text === "string" && text.trim()) {
      content.push({ type: "text", text: `Text layer of this page:\n${text.slice(0, 8000)}` });
    }
    content.push({ type: "text", text: "Analyze this page." });

    const analyse = (c: OpenRouterContent[]) => openRouterJSON<Partial<PageAnalysis>>({ system: systemPrompt, content: c, maxTokens: 3000 });

    // Picture-only pages: small vision models can't follow a JSON schema reliably, so have one read the page into text and
    // let the text model do the analysis. With no text layer there is nothing to anchor highlights to, so there are none.
    const readThenAnalyse = async () => {
      const described = await nvidiaDescribePage(image);
      const analysis = await analyse([
        { type: "text", text: `Text read from the page image (this page has no text layer, so return "highlights": []):\n${described.slice(0, 8000)}` },
        { type: "text", text: "Analyze this page." },
      ]);
      return { ...analysis, highlights: [] };
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
