/**
 * NVIDIA NIM (build.nvidia.com) client. The API is OpenAI-compatible, so this is a thin fetch wrapper with the
 * production concerns a shared hosted endpoint needs: a per-call timeout, one retry on a smaller fallback model when the
 * big one is overloaded, and "thinking" switched off so replies come back fast and as clean text.
 */
const BASE_URL = (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/$/, "");
// Measured on a real account: the 120B model answers in ~2s; the 550B one is far slower and often "overloaded",
// so it is the fallback rather than the default. The 11B vision model reads handwriting in ~7s; the 90B one timed out.
const TEXT_MODELS = [
  process.env.NVIDIA_MODEL || "nvidia/nemotron-3-super-120b-a12b",
  process.env.NVIDIA_FALLBACK_MODEL || "nvidia/nemotron-3-ultra-550b-a55b",
];
const VISION_MODELS = [
  process.env.NVIDIA_VISION_MODEL || "meta/llama-3.2-11b-vision-instruct",
  process.env.NVIDIA_VISION_FALLBACK_MODEL || process.env.NVIDIA_VISION_MODEL || "meta/llama-3.2-11b-vision-instruct", // retry once
];
const TIMEOUT_MS = Number(process.env.NVIDIA_TIMEOUT_MS) || 28_000;

export type NvidiaContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

export const nvidiaConfigured = () => !!process.env.NVIDIA_API_KEY;

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

async function callOnce(model: string, system: string | undefined, user: NvidiaContent, maxTokens: number, temperature: number): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: user }],
    temperature,
    top_p: 0.95,
    max_tokens: maxTokens,
    stream: false,
  };
  // Nemotron reasoning models accept this; others would reject an unknown field.
  if (model.includes("nemotron")) body.chat_template_kwargs = { enable_thinking: false };

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err = new Error(`NVIDIA ${res.status} (${model}): ${detail.replace(/\s+/g, " ").slice(0, 160)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text: string | undefined = data.choices?.[0]?.message?.content;
  if (!text || !text.trim()) throw new Error(`NVIDIA (${model}) returned an empty reply`);
  return text;
}

/** One chat completion. Tries the primary model, then the fallback once if the failure looks transient. */
export async function nvidiaChat(opts: {
  system?: string;
  user: NvidiaContent;
  vision?: boolean;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  if (!nvidiaConfigured()) throw new Error("NVIDIA_API_KEY is not set");
  const models = opts.vision ? VISION_MODELS : TEXT_MODELS;
  let lastError: unknown;
  for (const model of models) {
    try {
      return await callOnce(model, opts.system, opts.user, opts.maxTokens ?? 2000, opts.temperature ?? 0.4);
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number }).status;
      const transient = status === undefined ? true : RETRYABLE.has(status); // timeouts and network errors have no status
      if (!transient) break; // a 401/400 won't get better on another model
      console.warn(`[nvidia] ${model} failed, ${model === models[models.length - 1] ? "giving up" : "trying fallback"}:`, err instanceof Error ? err.message : err);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("NVIDIA request failed");
}

const JSON_ONLY = "Respond with a single valid JSON object only. No prose, no markdown fences.";

export const withJsonInstruction = (system?: string) => (system ? `${system}\n\n${JSON_ONLY}` : JSON_ONLY);

/**
 * Reads a handwritten solution into plain lines. Vision models read handwriting well but reason poorly about
 * mistakes, so the app transcribes here and lets the stronger text model judge the steps.
 */
export async function nvidiaTranscribe(imageBase64: string, mimeType: string): Promise<string[]> {
  const url = imageBase64.startsWith("data:") ? imageBase64 : `data:${mimeType};base64,${imageBase64}`;
  const text = await nvidiaChat({
    system: "You transcribe handwritten student work exactly as written, including any mistakes. Never correct, solve or comment.",
    user: [
      { type: "text", text: "Transcribe every line of this handwritten work, one line per row, in plain text (use ^ for powers and / for fractions). Output only the lines." },
      { type: "image_url", image_url: { url } },
    ],
    vision: true,
    maxTokens: 800,
    temperature: 0,
  });
  return text
    .split("\n")
    .map((l) => l.replace(/^[\s>*#-]*(?:\d+[.)]\s+)?/, "").replace(/\*\*/g, "").trim())
    .filter((l) => l && !/^(transcri|here is|here are)/i.test(l));
}

/** Reads a slide or textbook page that has no text layer into plain text (formulas written out, diagrams described). */
export async function nvidiaDescribePage(imageDataUrl: string): Promise<string> {
  return nvidiaChat({
    system: "You read lecture slides and textbook pages for a study tool. Be faithful and complete; never add information.",
    user: [
      {
        type: "text",
        text: "Write out everything on this page as plain text: all headings and sentences, every formula or equation (use ^ for powers, / for fractions, Unicode symbols like ∑ ∈ ≤), and a one-line description of any diagram or figure. Output only the page content.",
      },
      { type: "image_url", image_url: { url: imageDataUrl } },
    ],
    vision: true,
    maxTokens: 1500,
    temperature: 0,
  });
}
