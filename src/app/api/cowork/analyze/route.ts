import { NextRequest, NextResponse } from "next/server";
import { openRouterJSON, type OpenRouterContent } from "@/lib/aiProvider";
import type { HighlightKind, PageAnalysis, PageHighlight } from "@/types/cowork";

const systemPrompt = `You are an AI study partner in "CoWork" mode. A student preparing for university exams is reading ONE page of a lecture PDF; you see the page as an image (and its text layer when it has one).

Return ONLY a JSON object:
{
  "hasContent": boolean,          // false for title slides, "thank you" slides, blank or index pages
  "title": string,                // topic of this page, max 8 words
  "summary": string,              // 2-4 sentence plain-language explanation. Markdown **bold** allowed. No LaTeX, no tables.
  "keyPoints": string[],          // 2-5 crisp facts / definitions from this page
  "formulas": [{ "name": string, "formula": string, "note": string }],  // every formula, notation or rule on the page; [] if none
  "practice": [{ "question": string, "options": [4 strings without "A)" prefixes], "answer": 0-3, "explanation": string }],  // 1-2 MCQs; [] if no content
  "examTip": string,              // one line on how this is asked in exams, or "" if not examinable
  "highlights": [{ "box": [ymin, xmin, ymax, xmax], "kind": "important" | "definition" | "formula" | "keyword", "label": string }]
}

Highlights mark where on the page image the student should look. Rules:
- box is a tight bounding box around the exact words/line, normalized 0-1000 relative to the image.
- 2-5 highlights for content pages, [] otherwise. Never overlap boxes. Never box the logo, header bar or page number.
- "important" = most likely to be asked in exams (use for at most 2), "definition" = a definition, "formula" = an equation or notation, "keyword" = a key term.
- label: 1-4 words shown next to the highlight, e.g. "Exam favourite", "Definition", "Remember this", "Key formula".

Write all math with Unicode (∈, ∉, ⊆, ∪, ∩, ≠, ≤, ², √, Σ, →), never LaTeX.`;

const KINDS: HighlightKind[] = ["important", "definition", "formula", "keyword"];

function cleanHighlights(raw: unknown): PageHighlight[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((h) => h && Array.isArray(h.box) && h.box.length === 4 && h.box.every((n: unknown) => typeof n === "number"))
    .map((h) => {
      const [y1, x1, y2, x2] = (h.box as number[]).map((n) => Math.min(1000, Math.max(0, n)));
      return {
        box: [Math.min(y1, y2), Math.min(x1, x2), Math.max(y1, y2), Math.max(x1, x2)] as PageHighlight["box"],
        kind: KINDS.includes(h.kind) ? h.kind : "keyword",
        label: typeof h.label === "string" ? h.label.slice(0, 32) : "",
      };
    })
    .filter((h) => h.box[2] - h.box[0] > 4 && h.box[3] - h.box[1] > 4)
    .slice(0, 6);
}

/** AI calls can take a while; give them room on serverless hosts. */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { image, text } = await request.json();
    if (typeof image !== "string" || !image.startsWith("data:image/")) {
      return NextResponse.json({ error: "A page image is required" }, { status: 400 });
    }

    const content: OpenRouterContent[] = [{ type: "image_url", image_url: { url: image } }];
    if (typeof text === "string" && text.trim()) {
      content.push({ type: "text", text: `Text layer of this page:\n${text.slice(0, 8000)}` });
    }
    content.push({ type: "text", text: "Analyze this page." });

    const raw = await openRouterJSON<Partial<PageAnalysis>>({ system: systemPrompt, content, maxTokens: 3000 });

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
