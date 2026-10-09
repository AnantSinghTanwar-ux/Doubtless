import { GoogleGenAI } from "@google/genai";
import { gatewayChat, gatewayEnabled, type GatewayContent } from "./gateway";
import { NVIDIA_EMBED_DIM, nvidiaChat, nvidiaConfigured, nvidiaDescribePage, nvidiaEmbed, withJsonInstruction, type NvidiaContent } from "./nvidia";

const apiKey = process.env.GEMINI_API_KEY || "placeholder_for_build";
const genai = new GoogleGenAI({ apiKey });

export function getModel() {
  return process.env.GEMINI_MODEL || "gemini-2.5-pro";
}

export function getEmbedModel() {
  return process.env.GEMINI_EMBED_MODEL || "text-embedding-004";
}

const useLocalProvider = process.env.AI_PROVIDER === "ollama";
/** AI_PROVIDER=nvidia makes NVIDIA NIM the first choice (recommended on hosts with no local model). */
const preferNvidia = process.env.AI_PROVIDER === "nvidia";
// Comma-separated list: several machines can host the models and the first one that answers is used.
const configuredOllama = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").split(",").map((u) => u.trim().replace(/\/$/, "")).filter(Boolean);
const isLocalHost = (u: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(u);
/** On your own machine only your own Ollama is used; remote (shared) hosts are for the deployed site. */
const ollamaUrls = process.env.VERCEL ? configuredOllama : configuredOllama.filter(isLocalHost).concat(configuredOllama.some(isLocalHost) ? [] : ["http://localhost:11434"]);

const ollamaModel = process.env.OLLAMA_MODEL || "llama3.2";
const ollamaEmbedModel = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const ollamaVisionModel = process.env.OLLAMA_VISION_MODEL || "llava";

/** POST to Ollama, trying each configured host in turn. OLLAMA_API_KEY is sent as a bearer token for hosts behind an auth proxy. */
async function ollamaPost(path: string, body: unknown): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.OLLAMA_API_KEY && process.env.VERCEL) headers.Authorization = `Bearer ${process.env.OLLAMA_API_KEY}`;
  const timeout = Number(process.env.OLLAMA_TIMEOUT_MS) || (process.env.VERCEL ? 40000 : 120000);
  const failures: string[] = [];
  for (const base of ollamaUrls) {
    try {
      const res = await fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
      if (res.ok) return res;
      failures.push(`${base} -> ${res.status} ${(await res.text()).slice(0, 120)}`);
    } catch (err) {
      failures.push(`${base} -> ${err instanceof Error ? err.message : err}`);
    }
  }
  ollamaPausedUntil = Date.now() + 30_000;
  throw new Error(`Ollama error: ${failures.join(" | ")}`);
}

/** After every Ollama host failed, skip Ollama for a short while so a switched-off laptop does not slow every request. */
let ollamaPausedUntil = 0;

/** Ollama is the main provider when AI_PROVIDER=ollama. Returns undefined when it is off, paused or failed, so the caller falls back. */
async function tryOllama<T>(run: () => Promise<T>): Promise<T | undefined> {
  if (!useLocalProvider || Date.now() < ollamaPausedUntil) return undefined;
  try {
    return await run();
  } catch (err) {
    console.warn("[aiProvider] Ollama failed, falling back:", err instanceof Error ? err.message : err);
    return undefined;
  }
}

async function ollamaJSON<T>(prompt: string, systemPrompt?: string): Promise<T> {
  console.log(`[aiProvider] Routing to Ollama (${ollamaModel}) at ${ollamaUrls.join(", ")}`);
  const res = await ollamaPost("/api/generate", { model: ollamaModel, prompt, system: systemPrompt, format: "json", stream: false, options: { num_ctx: 16384 } });
  return parseJSON<T>((await res.json()).response, "Ollama");
}

async function ollamaText(prompt: string, systemPrompt?: string): Promise<string> {
  const res = await ollamaPost("/api/generate", { model: ollamaModel, prompt, system: systemPrompt, stream: false, options: { num_ctx: 16384 } });
  return (await res.json()).response ?? "";
}

async function ollamaVision(prompt: string, imageBase64: string, systemPrompt?: string): Promise<string> {
  const images = [imageBase64.replace(/^data:image\/\w+;base64,/, "")];
  const res = await ollamaPost("/api/generate", { model: ollamaVisionModel, prompt, system: systemPrompt, images, stream: false, format: "json" });
  return (await res.json()).response ?? "";
}

async function ollamaEmbed(text: string): Promise<number[]> {
  const res = await ollamaPost("/api/embeddings", { model: ollamaEmbedModel, prompt: text });
  const embedding: number[] = (await res.json()).embedding ?? [];
  if (embedding.length === 0) throw new Error("Ollama returned an empty embedding");
  return embedding;
}

/** Embeds every text with one function, a handful in flight at once. */
async function embedAll(texts: string[], embed: (text: string) => Promise<number[]>): Promise<number[][]> {
  // Sequential calls make a 100-chunk document exceed serverless time limits.
  const results: number[][] = new Array(texts.length);
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < texts.length; i = next++) results[i] = await embed(texts[i]);
  };
  await Promise.all(Array.from({ length: Math.min(6, texts.length) }, worker));
  return results;
}

export function parseJSON<T>(raw: string | undefined, source: string): T {
  // Models sometimes wrap JSON in ```json fences or add prose around it.
  const text = (raw ?? "").trim();
  const candidates = [text, text.replace(/^```(?:json)?\s*|\s*```$/g, "")];
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));
  for (const c of candidates) {
    try {
      return JSON.parse(c) as T;
    } catch {}
  }
  console.error(`${source} JSON Parse Error:`, text);
  throw new Error(`${source} returned invalid JSON`);
}

/**
 * Tries the configured provider first. If it fails (e.g. AI_PROVIDER=ollama on a host with no local model,
 * or a bad/missing Gemini key), falls back to OpenRouter when a key is available, so features degrade gracefully.
 */
export async function generateJSON<T>(prompt: string, systemPrompt?: string, useHighEnd?: boolean): Promise<T> {
  const local = await tryOllama(() => ollamaJSON<T>(prompt, systemPrompt));
  if (local !== undefined) return local;
  if (gatewayEnabled()) {
    try {
      return parseJSON<T>(await gatewayChat({ system: withJsonInstruction(systemPrompt), user: prompt, json: true, maxTokens: 3000 }), "Gateway");
    } catch (err) {
      console.warn("[aiProvider] gateway failed, falling back:", err instanceof Error ? err.message : err);
    }
  }
  // A model occasionally returns malformed or cut-off JSON; one more attempt (with more room) usually fixes it.
  const nvidiaJSON = async () => {
    try {
      return parseJSON<T>(await nvidiaChat({ system: withJsonInstruction(systemPrompt), user: prompt, maxTokens: 3000 }), "NVIDIA");
    } catch (err) {
      if (!(err instanceof Error && /invalid JSON/i.test(err.message))) throw err;
      return parseJSON<T>(await nvidiaChat({ system: withJsonInstruction(systemPrompt), user: prompt, maxTokens: 4500, temperature: 0.2 }), "NVIDIA");
    }
  };
  if (preferNvidia && nvidiaConfigured()) {
    try {
      return await nvidiaJSON();
    } catch (err) {
      console.warn("[aiProvider] NVIDIA failed, falling back:", err instanceof Error ? err.message : err);
    }
  }
  try {
    return await generateJSONPrimary<T>(prompt, systemPrompt, useHighEnd);
  } catch (primaryError) {
    if (!preferNvidia && nvidiaConfigured()) {
      console.warn("[aiProvider] primary provider failed, trying NVIDIA:", primaryError instanceof Error ? primaryError.message : primaryError);
      try {
        return await nvidiaJSON();
      } catch (err) {
        console.warn("[aiProvider] NVIDIA failed too:", err instanceof Error ? err.message : err);
      }
    }
    const key = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
    // useHighEnd already tried OpenRouter inside the primary path.
    if (!key || useHighEnd) throw primaryError;
    const baseUrl = process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1";
    console.warn("[aiProvider] trying OpenRouter/OpenAI:", primaryError instanceof Error ? primaryError.message : primaryError);
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
        max_tokens: Number(process.env.OPENROUTER_MAX_TOKENS) || 2000,
        messages: [...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []), { role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw primaryError;
    const data = await res.json();
    return parseJSON<T>(data.choices?.[0]?.message?.content, "OpenRouter");
  }
}

async function generateJSONPrimary<T>(prompt: string, systemPrompt?: string, useHighEnd?: boolean): Promise<T> {
  const openRouterKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
  const openRouterModel = process.env.OPENAI_MODEL || process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-5.5";
  const baseUrl = process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1";

  if (useHighEnd && openRouterKey) {
    console.log(`[aiProvider] Routing to OpenRouter/OpenAI API (${openRouterModel}) for high-end task`);
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: openRouterModel,
          // Without a cap OpenRouter reserves the model's full output window, which fails on low-credit keys.
          max_tokens: Number(process.env.OPENROUTER_MAX_TOKENS) || 2000,
          messages: [
            ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OpenRouter error ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      return parseJSON<T>(data.choices?.[0]?.message?.content, "OpenRouter");
    } catch (err) {
      // Fall through to the local / Gemini provider instead of failing the request.
      console.warn("[aiProvider] OpenRouter failed, falling back:", err instanceof Error ? err.message : err);
    }
  }

  const model = getModel();
  const response = await genai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
    },
  });
  return parseJSON<T>(response.text, "Gemini");
}

export async function generateText(prompt: string, systemPrompt?: string): Promise<string> {
  const localText = await tryOllama(() => ollamaText(prompt, systemPrompt));
  if (localText !== undefined) return localText;
  if (gatewayEnabled()) {
    try {
      return await gatewayChat({ system: systemPrompt, user: prompt, maxTokens: 3000 });
    } catch (err) {
      console.warn("[aiProvider] gateway failed, falling back:", err instanceof Error ? err.message : err);
    }
  }
  if (preferNvidia && nvidiaConfigured()) {
    try {
      return await nvidiaChat({ system: systemPrompt, user: prompt, maxTokens: 3000 });
    } catch (err) {
      console.warn("[aiProvider] NVIDIA failed, falling back:", err instanceof Error ? err.message : err);
    }
  }
  try {
    return await generateTextPrimary(prompt, systemPrompt);
  } catch (primaryError) {
    if (!preferNvidia && nvidiaConfigured()) {
      console.warn("[aiProvider] primary text provider failed, trying NVIDIA:", primaryError instanceof Error ? primaryError.message : primaryError);
      return nvidiaChat({ system: systemPrompt, user: prompt, maxTokens: 3000 }).catch(() => Promise.reject(primaryError));
    }
    throw primaryError;
  }
}

async function generateTextPrimary(prompt: string, systemPrompt?: string): Promise<string> {
  const model = getModel();
  const response = await genai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
    },
  });
  return response.text ?? "";
}

export async function generateWithImage(
  prompt: string,
  imageBase64: string,
  mimeType: string,
  systemPrompt?: string
): Promise<string> {
  const localVision = await tryOllama(() => ollamaVision(prompt, imageBase64, systemPrompt));
  if (localVision !== undefined) return localVision;
  if (gatewayEnabled()) {
    try {
      const url = imageBase64.startsWith("data:") ? imageBase64 : `data:${mimeType};base64,${imageBase64}`;
      return await gatewayChat({
        system: withJsonInstruction(systemPrompt),
        user: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url } }],
        json: true,
        vision: true,
        maxTokens: 3000,
      });
    } catch (err) {
      console.warn("[aiProvider] gateway vision failed, falling back:", err instanceof Error ? err.message : err);
    }
  }
  const viaNvidia = () => {
    const url = imageBase64.startsWith("data:") ? imageBase64 : `data:${mimeType};base64,${imageBase64}`;
    return nvidiaChat({
      system: withJsonInstruction(systemPrompt),
      user: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url } }],
      vision: true,
      maxTokens: 3000,
    });
  };
  if (preferNvidia && nvidiaConfigured()) {
    try {
      return await viaNvidia();
    } catch (err) {
      console.warn("[aiProvider] NVIDIA vision failed, falling back:", err instanceof Error ? err.message : err);
    }
  }
  try {
    return await generateWithImagePrimary(prompt, imageBase64, mimeType, systemPrompt);
  } catch (primaryError) {
    if (!preferNvidia && nvidiaConfigured()) {
      console.warn("[aiProvider] primary vision provider failed, trying NVIDIA:", primaryError instanceof Error ? primaryError.message : primaryError);
      return viaNvidia().catch(() => Promise.reject(primaryError));
    }
    throw primaryError;
  }
}

async function generateWithImagePrimary(
  prompt: string,
  imageBase64: string,
  mimeType: string,
  systemPrompt?: string
): Promise<string> {
  const model = getModel();
  const response = await genai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: imageBase64,
              mimeType,
            },
          },
        ],
      },
    ],
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
    },
  });
  return response.text ?? "";
}

async function embedTextPrimary(text: string): Promise<number[]> {
  const model = getEmbedModel();
  const response = await genai.models.embedContent({ model, contents: text });
  const values = response.embeddings?.[0]?.values ?? [];
  if (values.length === 0) throw new Error("Gemini returned an empty embedding");
  return values;
}

/**
 * Embeds a search question. A document must be searched with the model that indexed it, and models produce vectors of
 * different lengths, so the stored vector length (`dim`) picks the model. Without it, the normal provider chain is used.
 */
export async function embedText(text: string, dim?: number): Promise<number[]> {
  if (dim === NVIDIA_EMBED_DIM && nvidiaConfigured()) return (await nvidiaEmbed([text], "query"))[0];
  const localVec = await tryOllama(async () => {
    const v = await ollamaEmbed(text);
    // A document must be searched with the model that indexed it; a vector of another length cannot match.
    if (dim && v.length !== dim) throw new Error(`Ollama embedding has ${v.length} dimensions, expected ${dim}`);
    return v;
  });
  if (localVec) return localVec;
  if (preferNvidia && nvidiaConfigured() && !dim) {
    try {
      return (await nvidiaEmbed([text], "query"))[0];
    } catch (err) {
      console.warn("[aiProvider] NVIDIA embedding failed, falling back:", err instanceof Error ? err.message : err);
    }
  }
  try {
    return await embedTextPrimary(text);
  } catch (err) {
    if (!dim && nvidiaConfigured()) return (await nvidiaEmbed([text], "query"))[0];
    throw err;
  }
}

/** Embeds document chunks. The whole batch uses ONE model, so a document's vectors are always comparable. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const localVecs = await tryOllama(() => embedAll(texts, ollamaEmbed));
  if (localVecs) return localVecs;
  const viaPrimary = () => embedAll(texts, embedTextPrimary);
  if (preferNvidia && nvidiaConfigured()) {
    try {
      return await nvidiaEmbed(texts, "passage");
    } catch (err) {
      console.warn("[aiProvider] NVIDIA embeddings failed, falling back:", err instanceof Error ? err.message : err);
    }
  }
  try {
    return await viaPrimary();
  } catch (err) {
    if (!nvidiaConfigured()) throw err;
    console.warn("[aiProvider] primary embeddings failed, using NVIDIA:", err instanceof Error ? err.message : err);
    return nvidiaEmbed(texts, "passage");
  }
}

export type OpenRouterContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/**
 * Multimodal JSON call (used by CoWork and teacher screening, which need vision). Prefers OpenRouter and falls
 * back to Gemini when OpenRouter is unconfigured, out of credit or erroring, so these features keep working.
 */
export async function openRouterJSON<T>(opts: {
  model?: string;
  system: string;
  content: OpenRouterContent[];
  maxTokens: number;
}): Promise<T> {
  const attempts: [string, () => Promise<T>][] = [];
  const hasImages = opts.content.some((c) => c.type === "image_url");
  // llama3.2 cannot see images, so Ollama only goes first for text-only requests; with images it stays the last resort.
  const ollamaFirst = useLocalProvider && !hasImages && Date.now() >= ollamaPausedUntil;
  if (ollamaFirst) attempts.push(["Ollama", () => ollamaTextJSON<T>(opts)]);
  // Pages with no text layer: on your own machine, read them with the local vision model rather than shipping them online.
  if (useLocalProvider && !process.env.VERCEL && hasImages && Date.now() >= ollamaPausedUntil) attempts.push(["Ollama (llava reads the page)", () => ollamaVisionJSON<T>(opts)]);
  if (gatewayEnabled()) {
    attempts.push([
      "Gateway",
      async () =>
        parseJSON<T>(
          await gatewayChat({
            system: withJsonInstruction(opts.system),
            user: opts.content as GatewayContent,
            json: true,
            vision: opts.content.some((c) => c.type === "image_url"),
            maxTokens: Math.max(opts.maxTokens, 1500),
          }),
          "Gateway"
        ),
    ]);
  }
  const nvidiaAttempt: [string, () => Promise<T>] = ["NVIDIA", () => nvidiaMultimodalJSON<T>(opts)];
  if (preferNvidia && nvidiaConfigured()) attempts.push(nvidiaAttempt);
  if (process.env.OPENROUTER_API_KEY) attempts.push(["OpenRouter", () => openRouterRequest<T>(opts)]);
  if (process.env.GEMINI_API_KEY) attempts.push(["Gemini", () => geminiMultimodalJSON<T>(opts)]);
  if (!preferNvidia && nvidiaConfigured()) attempts.push(nvidiaAttempt);
  if (useLocalProvider && !ollamaFirst) attempts.push(["Ollama (text only)", () => ollamaTextJSON<T>(opts)]);
  if (attempts.length === 0) throw new Error("No AI provider is configured. Set GEMINI_API_KEY or OPENROUTER_API_KEY.");

  const failures: string[] = [];
  for (const [name, run] of attempts) {
    try {
      return await run();
    } catch (err) {
      failures.push(`${name}: ${shortError(err)}`);
      console.warn(`[aiProvider] ${name} failed:`, err instanceof Error ? err.message : err);
    }
  }
  throw new Error(`All AI providers failed. ${failures.join(" | ")}`);
}

/** One readable line from provider errors, which are often raw JSON blobs. */
function shortError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const msg = JSON.parse(raw)?.error?.message;
    if (typeof msg === "string") return msg.slice(0, 140);
  } catch {}
  return raw.replace(/\s+/g, " ").slice(0, 140);
}

/** Text and images through NVIDIA: a vision model when the request carries images, otherwise the text model. */
async function nvidiaMultimodalJSON<T>(opts: { system: string; content: OpenRouterContent[]; maxTokens: number }): Promise<T> {
  let content = opts.content;
  const imageCount = content.filter((c) => c.type === "image_url").length;
  if (imageCount > 1) {
    // The vision models take a single image per request: read each page picture into text first (capped, a few at a time).
    const urls = [...new Set(content.flatMap((c) => (c.type === "image_url" ? [c.image_url.url] : [])))].slice(0, 24);
    const read = new Map<string, string>();
    let next = 0;
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        for (let i = next++; i < urls.length; i = next++) {
          read.set(urls[i], await nvidiaDescribePage(urls[i]).catch(() => ""));
        }
      })
    );
    content = content.flatMap((c): OpenRouterContent[] =>
      c.type === "image_url" ? (read.get(c.image_url.url) ? [{ type: "text", text: `(text read from the page image)\n${read.get(c.image_url.url)}` }] : []) : [c]
    );
  }
  const hasImages = content.some((c) => c.type === "image_url");
  const text = await nvidiaChat({
    system: withJsonInstruction(opts.system),
    user: content as NvidiaContent,
    vision: hasImages,
    maxTokens: Math.max(opts.maxTokens, 1500),
  });
  return parseJSON<T>(text, "NVIDIA");
}

/** llava reads each page picture into text (one at a time, capped), then the text model does the reasoning. */
async function ollamaVisionJSON<T>(opts: { system: string; content: OpenRouterContent[]; maxTokens: number }): Promise<T> {
  const urls = [...new Set(opts.content.flatMap((c) => (c.type === "image_url" ? [c.image_url.url] : [])))].slice(0, 12);
  const read = new Map<string, string>();
  for (const url of urls) {
    const res = await ollamaPost("/api/generate", {
      model: ollamaVisionModel,
      prompt: "Write out all the text on this slide or page exactly as written, including formulas. Then add one short line describing any diagram. Output only that.",
      images: [url.replace(/^data:image\/\w+;base64,/, "")],
      stream: false,
    });
    read.set(url, ((await res.json()).response ?? "").trim());
  }
  const content = opts.content.flatMap((c): OpenRouterContent[] =>
    c.type === "image_url" ? (read.get(c.image_url.url) ? [{ type: "text", text: `(text read from the page image)\n${read.get(c.image_url.url)}` }] : []) : [c]
  );
  return ollamaTextJSON<T>({ system: opts.system, content });
}

/** Last resort on a machine with a local model: text parts only, since the default model can't see images. */
async function ollamaTextJSON<T>(opts: { system: string; content: OpenRouterContent[] }): Promise<T> {
  const prompt = opts.content.map((c) => (c.type === "text" ? c.text : "")).filter(Boolean).join("\n");
  const res = await ollamaPost("/api/generate", { model: ollamaModel, prompt, system: opts.system, format: "json", stream: false, options: { num_ctx: 16384 } });
  if (!res.ok) throw new Error(`Ollama error ${res.status}`);
  const data = await res.json();
  return parseJSON<T>(data.response, "Ollama");
}

async function geminiMultimodalJSON<T>(opts: { system: string; content: OpenRouterContent[] }): Promise<T> {
  const parts = opts.content.map((c) => {
    if (c.type === "text") return { text: c.text };
    const m = c.image_url.url.match(/^data:([^;]+);base64,(.*)$/);
    return m ? { inlineData: { mimeType: m[1], data: m[2] } } : { text: "[image unavailable]" };
  });
  const response = await genai.models.generateContent({
    model: getModel(),
    contents: [{ role: "user", parts }],
    config: { systemInstruction: opts.system, responseMimeType: "application/json" },
  });
  return parseJSON<T>(response.text, "Gemini");
}

async function openRouterRequest<T>(opts: {
  model?: string;
  system: string;
  content: OpenRouterContent[];
  maxTokens: number;
}): Promise<T> {
  const key = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY or OPENAI_API_KEY is not set");
  const model = opts.model || process.env.OPENAI_MODEL || process.env.COWORK_MODEL || "google/gemini-2.5-flash";
  const baseUrl = process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.content },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    let message = body;
    try {
      message = JSON.parse(body).error?.message || body;
    } catch {}
    if (res.status === 402) {
      throw new Error("Your OpenRouter balance is too low for this request. Add credits at openrouter.ai/settings/credits and try again.");
    }
    throw new Error(`OpenRouter ${res.status}: ${message}`);
  }
  const data = await res.json();
  return parseJSON<T>(data.choices?.[0]?.message?.content, "OpenRouter");
}
