import { withUsage } from "@/lib/usage";
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { overviewCacheId, readCowork, writeCowork } from "@/lib/coworkCache";
import os from "os";
import path from "path";
import { openRouterJSON, type OpenRouterContent } from "@/lib/aiProvider";
import { getFolderPastPaperText } from "@/lib/embeddings";
import { getVaultChunks } from "@/lib/firestore";
import type { DocumentOverview, OverviewPageInput } from "@/types/cowork";

// The cache is an optimisation only. Serverless hosts have a read-only app dir, so use the temp dir there.
const CACHE_DIR = process.env.VERCEL ? path.join(os.tmpdir(), ".cowork-cache") : path.join(process.cwd(), ".cowork-cache");
const inFlight = new Map<string, Promise<DocumentOverview>>();

const systemPrompt = `You are an expert university tutor. You receive EVERY page of a lecture PDF (as text, or as an image when the page has no text layer), each tagged with its page number. Build an exam-focused study guide for the WHOLE document. Use plain text and Markdown only: never HTML tags such as <br>. Do not repeat yourself.

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

/** Saved study guide: Firestore (shared, survives redeploys), falling back to the local disk copy. */
async function readCached(vaultId: string): Promise<DocumentOverview | null> {
  const saved = await readCowork<DocumentOverview>(overviewCacheId(vaultId));
  if (saved) return saved;
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

/**
 * Scanned pages arrive as pictures. Their text was already read (OCR) and indexed when the file was uploaded, so use that
 * instead: a text model writes the guide in seconds, where a local vision model takes minutes for a dozen pictures.
 */
async function withIndexedText(vaultId: string, pages: OverviewPageInput[]): Promise<OverviewPageInput[]> {
  const missing = (p: OverviewPageInput) => "image" in p || p.text.trim().length < 40;
  if (!pages.some(missing)) return pages;
  try {
    const byPage = new Map<number, string>();
    for (const c of (await getVaultChunks(vaultId)).sort((a, b) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0))) {
      byPage.set(c.pageNumber, `${byPage.get(c.pageNumber) ?? ""}\n${c.text}`);
    }
    return pages.map((p) => {
      const text = missing(p) ? byPage.get(p.page)?.trim() : undefined;
      return text && text.length >= 40 ? { page: p.page, text } : p;
    });
  } catch {
    return pages;
  }
}

/*
 * Long documents don't fit in one prompt (a local model sees ~16k tokens), and a truncated prompt gives a guide that
 * covers only part of the document. Above this many characters the pages are condensed in parts first, then combined.
 */
const BUDGET = Number(process.env.COWORK_OVERVIEW_BUDGET) || (process.env.VERCEL ? 60_000 : 24_000);

const condensePrompt = `You are condensing PART of a lecture document so a study guide can be written from it later.
Return ONLY a JSON object: { "notes": string }
notes: compact study notes for exactly these pages (at most ~500 words). For each topic: its name, the page numbers in brackets like [p.12-14], the key definitions and ideas in one or two lines, every formula or rule (Unicode math, never LaTeX), and any likely exam question. No introduction, no filler.`;

async function condense(pages: { page: number; text: string }[]): Promise<string> {
  const raw = await openRouterJSON<Record<string, unknown>>({
    system: condensePrompt,
    content: [...pages.map((p) => ({ type: "text" as const, text: `--- Page ${p.page} ---\n${p.text.slice(0, 4000)}` })), { type: "text", text: "Condense these pages. Return JSON only." }],
    maxTokens: 1500,
  });
  // Small models sometimes return a list, or name the field differently; any readable text is fine here.
  const flat = (v: unknown): string =>
    typeof v === "string" ? v : Array.isArray(v) ? v.map(flat).filter(Boolean).join("\n") : v && typeof v === "object" ? Object.entries(v).map(([k, x]) => `${k}: ${flat(x)}`).join("\n") : "";
  return flat(raw.notes ?? raw).slice(0, 6000);
}

async function buildOverview(pages: OverviewPageInput[], folderId: string | null, total: number): Promise<DocumentOverview> {
  let pastPapers = "";
  if (folderId) {
    try {
      pastPapers = await getFolderPastPaperText(folderId);
    } catch (err) {
      console.warn("CoWork overview: past paper lookup failed:", err);
    }
  }

  const textPages = pages.filter((p): p is { page: number; text: string } => "text" in p && p.text.trim().length >= 40);
  const imagePages = pages.filter((p): p is { page: number; image: string } => "image" in p);
  const textChars = textPages.reduce((n, p) => n + Math.min(4000, p.text.length), 0);

  const content: OpenRouterContent[] = [];
  let covered: number;
  if (textChars > BUDGET) {
    // Condense in parts that each fit, then write the guide from the condensed notes. Pictures are left out at this size.
    const batches: { page: number; text: string }[][] = [[]];
    let size = 0;
    for (const p of textPages) {
      const n = Math.min(4000, p.text.length);
      if (size + n > BUDGET * 0.8 && batches[batches.length - 1].length) {
        batches.push([]);
        size = 0;
      }
      batches[batches.length - 1].push(p);
      size += n;
    }
    // A local model works one request at a time anyway; cloud providers take a few in parallel.
    const parallel = process.env.VERCEL ? 4 : 1;
    const notes: string[] = new Array(batches.length).fill("");
    for (let i = 0; i < batches.length; i += parallel) {
      await Promise.all(
        batches.slice(i, i + parallel).map(async (batch, j) => {
          notes[i + j] = await condense(batch).catch((err) => (console.warn("CoWork overview: condensing failed:", err instanceof Error ? err.message : err), ""));
        })
      );
    }
    batches.forEach((batch, i) => {
      if (notes[i]) content.push({ type: "text", text: `--- Pages ${batch[0].page}-${batch[batch.length - 1].page} (condensed notes) ---\n${notes[i]}` });
    });
    covered = batches.reduce((n, b, i) => n + (notes[i] ? b.length : 0), 0);
  } else {
    for (const p of pages) {
      if ("image" in p) {
        content.push({ type: "text", text: `--- Page ${p.page} (image) ---` });
        content.push({ type: "image_url", image_url: { url: p.image } });
      } else if (p.text.trim().length >= 40) {
        content.push({ type: "text", text: `--- Page ${p.page} ---\n${p.text.slice(0, 4000)}` });
      }
    }
    covered = textPages.length + imagePages.length;
  }
  if (!content.length) throw new Error("No readable pages yet");

  content.push({
    type: "text",
    text: pastPapers
      ? `PAST PAPERS from the student's folder:\n${pastPapers}`
      : "No past papers were provided for this subject.",
  });
  content.push({ type: "text", text: "Now produce the study guide JSON." });

  const raw = await openRouterJSON<Partial<DocumentOverview>>({ system: systemPrompt, content, maxTokens: 8000 });
  return { ...normalize(raw, !!pastPapers), coverage: { pages: covered, total } };
}

export async function GET(request: NextRequest) {
  const vaultId = request.nextUrl.searchParams.get("vaultId");
  if (!validId(vaultId)) return NextResponse.json({ error: "Invalid vaultId" }, { status: 400 });
  const cached = await readCached(vaultId);
  return cached ? NextResponse.json(cached) : NextResponse.json({ error: "Not generated yet" }, { status: 404 });
}

/** AI calls can take a while; give them room on serverless hosts. */
export const maxDuration = 300;

async function handlePost(request: NextRequest) {
  try {
    const { vaultId, folderId, pages, force, totalPages } = await request.json();
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
      const total = Number(totalPages) || pages.length;
      job = withIndexedText(vaultId, pages as OverviewPageInput[]).then((p) => buildOverview(p, typeof folderId === "string" ? folderId : null, total));
      inFlight.set(vaultId, job);
      job.finally(() => inFlight.delete(vaultId)).catch(() => {});
    }
    const overview = await job;

    await writeCowork(overviewCacheId(vaultId), overview);
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(cachePath(vaultId), JSON.stringify(overview));
    } catch {
      /* caching is best-effort */
    }
    return NextResponse.json(overview);
  } catch (error) {
    // Nothing readable yet (picture-only pages that haven't been read): the browser builds the guide from page notes later.
    if (error instanceof Error && error.message === "No readable pages yet") return NextResponse.json({ error: error.message, waiting: true }, { status: 422 });
    console.error("CoWork overview error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build overview" },
      { status: 500 }
    );
  }
}

/** Tracks the AI cost of each request (see src/lib/usage.ts). */
export const POST = withUsage("cowork.study-guide", handlePost);
