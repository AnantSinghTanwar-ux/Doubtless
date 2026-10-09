import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { openRouterJSON, type OpenRouterContent } from "@/lib/aiProvider";
import { getFolderPastPaperText } from "@/lib/embeddings";
import type { DocumentOverview, OverviewPageInput } from "@/types/cowork";

// The cache is an optimisation only. Serverless hosts have a read-only app dir, so use the temp dir there.
const CACHE_DIR = process.env.VERCEL ? path.join(os.tmpdir(), ".cowork-cache") : path.join(process.cwd(), ".cowork-cache");
const inFlight = new Map<string, Promise<DocumentOverview>>();

const systemPrompt = `You are an expert university tutor. You receive EVERY page of a lecture PDF (as text, or as an image when the page has no text layer), each tagged with its page number. Build an exam-focused study guide for the WHOLE document.

Return ONLY a JSON object:
{
  "subject": string,                  // e.g. "Discrete Mathematics — Set Theory"
  "isQuantitative": boolean,          // true for maths, physics, statistics, engineering, CS theory etc.
  "overview": string,                 // 5-8 sentence summary of the whole document. Markdown **bold** allowed.
  "topics": [{ "name": string, "pages": number[], "importance": "high"|"medium"|"low", "summary": string }],  // every major topic in reading order, summary = 1 sentence
  "formulas": [{ "name": string, "formula": string, "note": string, "page": number }],  // COMPLETE formula sheet: every formula, law, identity, notation and rule in the document. For quantitative subjects this must be thorough (15-40 entries is normal). [] only if the subject truly has none.
  "importantQuestions": [{ "question": string, "answer": string, "topic": string, "pages": number[], "priority": "high"|"medium" }],  // 8-15 likely exam questions answerable from this document; answer = concise model answer (2-5 sentences or steps)
  "pyqs": [{ "topic": string, "questions": [{ "question": string, "marks": number, "source": "past_paper"|"common" }] }]  // previous-year style questions grouped by topic, 2-4 per major topic
}

PYQ rules: if PAST PAPERS are provided, first extract the real questions from them that match this document's topics (source "past_paper"), then add frequently-asked university exam questions for the remaining topics (source "common"). Without past papers, every question is "common". marks is the typical mark weight (2, 5, 10 or 16).

Write all math with Unicode (∈, ∉, ⊆, ∪, ∩, ≠, ≤, ², √, Σ, →, ∀, ∃, ¬, ∧, ∨), never LaTeX.`;

const cachePath = (vaultId: string) => path.join(CACHE_DIR, `overview-${vaultId}.json`);
const validId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);

async function readCached(vaultId: string): Promise<DocumentOverview | null> {
  try {
    return JSON.parse(await fs.readFile(cachePath(vaultId), "utf8"));
  } catch {
    return null;
  }
}

function normalize(raw: Partial<DocumentOverview>, hasPastPapers: boolean): DocumentOverview {
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const pages = (v: unknown) => arr<number>(v).filter((n) => typeof n === "number");
  return {
    subject: typeof raw.subject === "string" ? raw.subject : "",
    isQuantitative: !!raw.isQuantitative,
    overview: typeof raw.overview === "string" ? raw.overview : "",
    topics: arr<DocumentOverview["topics"][number]>(raw.topics)
      .filter((t) => t && typeof t.name === "string")
      .map((t) => ({ ...t, pages: pages(t.pages), importance: t.importance || "medium", summary: t.summary || "" })),
    formulas: arr<DocumentOverview["formulas"][number]>(raw.formulas).filter((f) => f && typeof f.formula === "string"),
    importantQuestions: arr<DocumentOverview["importantQuestions"][number]>(raw.importantQuestions)
      .filter((q) => q && typeof q.question === "string")
      .map((q) => ({ ...q, answer: q.answer || "", topic: q.topic || "", pages: pages(q.pages), priority: q.priority === "high" ? "high" : "medium" })),
    pyqs: arr<DocumentOverview["pyqs"][number]>(raw.pyqs)
      .filter((g) => g && typeof g.topic === "string")
      .map((g) => ({
        topic: g.topic,
        questions: arr<DocumentOverview["pyqs"][number]["questions"][number]>(g.questions).filter((q) => q && typeof q.question === "string"),
      }))
      .filter((g) => g.questions.length > 0),
    hasPastPapers,
  };
}

async function buildOverview(pages: OverviewPageInput[], folderId: string | null): Promise<DocumentOverview> {
  let pastPapers = "";
  if (folderId) {
    try {
      pastPapers = await getFolderPastPaperText(folderId);
    } catch (err) {
      console.warn("CoWork overview: past paper lookup failed:", err);
    }
  }

  const content: OpenRouterContent[] = [];
  for (const p of pages) {
    if ("image" in p) {
      content.push({ type: "text", text: `--- Page ${p.page} (image) ---` });
      content.push({ type: "image_url", image_url: { url: p.image } });
    } else {
      content.push({ type: "text", text: `--- Page ${p.page} ---\n${p.text.slice(0, 4000)}` });
    }
  }
  content.push({
    type: "text",
    text: pastPapers
      ? `PAST PAPERS from the student's folder:\n${pastPapers}`
      : "No past papers were provided for this subject.",
  });
  content.push({ type: "text", text: "Now produce the study guide JSON." });

  const raw = await openRouterJSON<Partial<DocumentOverview>>({ system: systemPrompt, content, maxTokens: 8000 });
  return normalize(raw, !!pastPapers);
}

export async function GET(request: NextRequest) {
  const vaultId = request.nextUrl.searchParams.get("vaultId");
  if (!validId(vaultId)) return NextResponse.json({ error: "Invalid vaultId" }, { status: 400 });
  const cached = await readCached(vaultId);
  return cached ? NextResponse.json(cached) : NextResponse.json({ error: "Not generated yet" }, { status: 404 });
}

export async function POST(request: NextRequest) {
  try {
    const { vaultId, folderId, pages, force } = await request.json();
    if (!validId(vaultId)) return NextResponse.json({ error: "Invalid vaultId" }, { status: 400 });
    if (!Array.isArray(pages) || pages.length === 0) {
      return NextResponse.json({ error: "pages are required" }, { status: 400 });
    }

    if (!force) {
      const cached = await readCached(vaultId);
      if (cached) return NextResponse.json(cached);
    }

    // Collapse duplicate requests (e.g. two tabs, React strict mode) into one model call.
    let job = inFlight.get(vaultId);
    if (!job) {
      job = buildOverview(pages as OverviewPageInput[], typeof folderId === "string" ? folderId : null);
      inFlight.set(vaultId, job);
      job.finally(() => inFlight.delete(vaultId)).catch(() => {});
    }
    const overview = await job;

    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(cachePath(vaultId), JSON.stringify(overview));
    } catch {
      /* caching is best-effort */
    }
    return NextResponse.json(overview);
  } catch (error) {
    console.error("CoWork overview error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build overview" },
      { status: 500 }
    );
  }
}
