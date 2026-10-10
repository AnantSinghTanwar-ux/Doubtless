import { createHash } from "crypto";
import { GoogleGenAI } from "@google/genai";
import { estimateTokens, recordAiCall } from "./usage";
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

// Model names never contain spaces, and a typo like "llama 3.2" makes Ollama answer 400 "invalid model name", so strip them.
const cleanModel = (value: string | undefined, fallback: string) => (value || fallback).replace(/\s+/g, "");
const ollamaModel = cleanModel(process.env.OLLAMA_MODEL, "llama3.2");
const ollamaEmbedModel = cleanModel(process.env.OLLAMA_EMBED_MODEL, "nomic-embed-text");
// qwen2.5-vl reads slides and formulas faithfully (llava invents text) and is faster; llava stays as the fallback if it is not installed.
const ollamaVisionModel = cleanModel(process.env.OLLAMA_VISION_MODEL, "qwen2.5vl:3b");

/** POST to Ollama, trying each configured host in turn. OLLAMA_API_KEY is sent as a bearer token for hosts behind an auth proxy. */
async function ollamaPost(path: string, body: unknown, timeoutMs?: number): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.OLLAMA_API_KEY && process.env.VERCEL) headers.Authorization = `Bearer ${process.env.OLLAMA_API_KEY}`;
  const timeout = timeoutMs ?? (Number(process.env.OLLAMA_TIMEOUT_MS) || 120000);
  const failures: string[] = [];
  for (const base of ollamaUrls) {
    try {
      const res = await fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify({ keep_alive: process.env.OLLAMA_KEEP_ALIVE || "30m", ...(body as object) }), signal: AbortSignal.timeout(timeout) });
      if (res.ok) {
        // Report tokens (Ollama counts them; embeddings don't, so estimate) without consuming the caller's body.
        const b = body as { model?: string; prompt?: string };
        const d = await res.clone().json().catch(() => ({}) as Record<string, number>);
        recordAiCall({ provider: "ollama", model: String(b.model ?? "unknown"), inTokens: d.prompt_eval_count ?? estimateTokens(b.prompt ?? ""), outTokens: d.eval_count ?? 0 });
        return res;
      }
      failures.push(`${base} -> ${res.status} ${(await res.text()).replace(/\s+/g, " ").slice(0, 200)}`);
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
  const started = Date.now();
  try {
    const out = await run();
    console.log(`[aiProvider] answered by Ollama in ${Date.now() - started} ms`);
    return out;
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

let visionModelInUse = ollamaVisionModel;

/*
 * A laptop runs one vision request at a time. Sent together (CoWork asks for three pages at once), they queue inside
 * Ollama and each one's timeout runs while it waits, so they time out and pause Ollama for everyone. Queue them here
 * instead, so a timeout only measures the model's own work.
 */
let visionQueue: Promise<unknown> = Promise.resolve();
function visionPost(body: Record<string, unknown>, timeoutMs?: number): Promise<Response> {
  const run = visionQueue.then(() => visionPostNow(body, timeoutMs));
  visionQueue = run.catch(() => {});
  return run;
}

/** Vision request that falls back to llava once if the preferred model is not installed. */
async function visionPostNow(body: Record<string, unknown>, timeoutMs?: number): Promise<Response> {
  try {
    return await ollamaPost("/api/generate", { ...body, model: visionModelInUse }, timeoutMs);
  } catch (err) {
    if (visionModelInUse === "llava" || !/not found|404/i.test(String(err))) throw err;
    console.warn(`[aiProvider] vision model ${visionModelInUse} is not installed; using llava. Install it with: ollama pull ${visionModelInUse}`);
    visionModelInUse = "llava";
    ollamaPausedUntil = 0; // the failed attempt above was about a missing model, not an unreachable Ollama
    return ollamaPost("/api/generate", { ...body, model: visionModelInUse }, timeoutMs);
  }
}

/** The same page is read for the study guide and again for its page notes; remember what each picture said. */
const readCache = new Map<string, string>();

async function ollamaReadImage(dataUrl: string): Promise<string> {
  const key = `${visionModelInUse}:${createHash("sha1").update(dataUrl).digest("hex")}`;
  const hit = readCache.get(key);
  if (hit !== undefined) return hit;
  const res = await visionPost({
    prompt:
      "Transcribe this slide or page faithfully: every heading, sentence and formula exactly as written (use plain text or simple LaTeX for formulas). Do not add, guess or summarise anything that is not on the page. If there is a figure, finish with one short line saying what it shows.",
    images: [dataUrl.replace(/^data:image\/\w+;base64,/, "")],
    stream: false,
    options: { num_predict: 700, temperature: 0 },
  });
  const text = ((await res.json()).response ?? "").trim();
  if (text) {
    if (readCache.size >= 200) readCache.delete(readCache.keys().next().value as string);
    readCache.set(key, text);
  }
  return text;
}

async function ollamaVision(prompt: string, imageBase64: string, systemPrompt?: string): Promise<string> {
  const images = [imageBase64.replace(/^data:image\/\w+;base64,/, "")];
  const res = await visionPost({ prompt, system: systemPrompt, images, stream: false, format: "json" });
  return (await res.json()).response ?? "";
}

async function ollamaEmbed(text: string): Promise<number[]> {
  // An embedding takes well under a second; a long wait means Ollama is stuck, so give up quickly and let search continue.
  const res = await ollamaPost("/api/embeddings", { model: ollamaEmbedModel, prompt: text }, 20_000);
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

/* ---- usage reporting: every provider call tells the ledger how many tokens it used ---- */
type GeminiUsage = { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } };
function recordGemini(response: GeminiUsage, model: string) {
  const u = response.usageMetadata;
  recordAiCall({ provider: "gemini", model, inTokens: u?.promptTokenCount, outTokens: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0) });
}
/** OpenAI-compatible chat responses (OpenRouter, the gateway): provider is read from the endpoint that answered. */
function recordChat(data: { model?: string; usage?: { prompt_tokens?: number; completion_tokens?: number } }, url: string) {
  const provider = url.includes("openrouter") ? "openrouter" : url.includes("nvidia") ? "nvidia" : "gateway";
  recordAiCall({ provider, model: String(data?.model ?? "unknown"), inTokens: data?.usage?.prompt_tokens, outTokens: data?.usage?.completion_tokens });
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
    const { key, baseUrl } = openRouterCreds();
    // useHighEnd already tried OpenRouter inside the primary path.
    if (!key || useHighEnd) throw primaryError;
    console.warn("[aiProvider] trying OpenRouter:", primaryError instanceof Error ? primaryError.message : primaryError);
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
    recordChat(data, res.url);
    return parseJSON<T>(data.choices?.[0]?.message?.content, "OpenRouter");
  }
}

async function generateJSONPrimary<T>(prompt: string, systemPrompt?: string, useHighEnd?: boolean): Promise<T> {
  const { key: openRouterKey, baseUrl } = openRouterCreds();
  const openRouterModel = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-5.5";

  if (useHighEnd && openRouterKey) {
    console.log(`[aiProvider] Routing to OpenRouter (${openRouterModel}) for high-end task`);
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
      recordChat(data, res.url);
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
  recordGemini(response, model);
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
  recordGemini(response, model);
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
  recordGemini(response, model);
  return response.text ?? "";
}

async function embedTextPrimary(text: string): Promise<number[]> {
  const model = getEmbedModel();
  const response = await genai.models.embedContent({ model, contents: text });
  recordAiCall({ provider: "gemini", model, inTokens: estimateTokens(text) });
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
  // Ollama goes first. Pictures are read by llava, but only a few per request, so a request that is mostly pictures
  // (a scanned PDF) goes to the cloud first and Ollama stays the last resort; the "--- Page N (image) ---" markers are not real text.
  const imageCount = opts.content.filter((c) => c.type === "image_url").length;
  const realText = opts.content.reduce((n, c) => (c.type === "text" && !/^--- Page \d+ \(image\) ---$/.test(c.text.trim()) ? n + c.text.length : n), 0);
  const ollamaFirst = useLocalProvider && (imageCount <= MAX_OLLAMA_IMAGES || realText > 3000) && Date.now() >= ollamaPausedUntil;
  if (ollamaFirst) attempts.push(["Ollama", () => ollamaRead<T>(opts)]);
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
  if (useLocalProvider && !ollamaFirst) attempts.push(["Ollama (last resort)", () => ollamaRead<T>(opts)]);
  if (attempts.length === 0) throw new Error("No AI provider is configured. Set GEMINI_API_KEY or OPENROUTER_API_KEY.");

  const failures: string[] = [];
  for (const [name, run] of attempts) {
    try {
      const out = await run();
      console.log(`[aiProvider] answered by ${name}`);
      return out;
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

/** Pages llava reads per request: each one takes seconds, and a Vercel function has to finish within its time limit. */
const MAX_OLLAMA_IMAGES = process.env.VERCEL ? 6 : 12;

/** Pictures go through llava first (as text), plain text goes straight to the text model. */
function ollamaRead<T>(opts: { system: string; content: OpenRouterContent[]; maxTokens: number }): Promise<T> {
  return opts.content.some((c) => c.type === "image_url") ? ollamaVisionJSON<T>(opts) : ollamaTextJSON<T>(opts);
}

/** llava reads each page picture into text (one at a time, capped), then the text model does the reasoning. */
async function ollamaVisionJSON<T>(opts: { system: string; content: OpenRouterContent[]; maxTokens: number }): Promise<T> {
  const urls = [...new Set(opts.content.flatMap((c) => (c.type === "image_url" ? [c.image_url.url] : [])))].slice(0, MAX_OLLAMA_IMAGES);
  const read = new Map<string, string>();
  for (const url of urls) read.set(url, await ollamaReadImage(url));
  const content = opts.content.flatMap((c): OpenRouterContent[] =>
    c.type === "image_url" ? (read.get(c.image_url.url) ? [{ type: "text", text: `(text read from the page image)\n${read.get(c.image_url.url)}` }] : []) : [c]
  );
  return ollamaTextJSON<T>({ system: opts.system, content });
}

/** Last resort on a machine with a local model: text parts only, since the default model can't see images. */
/** A page analysis needs a few thousand tokens of context, not 16k; a smaller window means less memory and a faster start. */
function contextFor(promptChars: number, maxTokens = 1500): number {
  const need = Math.ceil(promptChars / 3) + maxTokens + 300;
  return Math.min(16384, Math.max(4096, Math.ceil(need / 2048) * 2048));
}

async function ollamaTextJSON<T>(opts: { system: string; content: OpenRouterContent[]; maxTokens?: number }): Promise<T> {
  const prompt = opts.content.map((c) => (c.type === "text" ? c.text : "")).filter(Boolean).join("\n");
  // A long answer (a CoWork study guide asks for 8000 tokens) takes a laptop model minutes, so it gets a longer wait and a token cap.
  const long = (opts.maxTokens ?? 0) > 2000;
  const res = await ollamaPost(
    "/api/generate",
    { model: ollamaModel, prompt, system: opts.system, format: "json", stream: false, options: { num_ctx: contextFor(prompt.length + opts.system.length, opts.maxTokens), ...(opts.maxTokens ? { num_predict: opts.maxTokens } : {}) } },
    long ? 240_000 : undefined
  );
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
  recordGemini(response, getModel());
  return parseJSON<T>(response.text, "Gemini");
}

/**
 * Credentials for the real OpenRouter. The OPENAI_* variables belong to the OpenAI-compatible gateway (gateway.ts, which has
 * its own step in every chain); sending OpenRouter requests there too meant a second call to a gateway that had just failed.
 */
const openRouterCreds = () => ({
  key: process.env.OPENROUTER_API_KEY,
  baseUrl: (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, ""),
});

async function openRouterRequest<T>(opts: {
  model?: string;
  system: string;
  content: OpenRouterContent[];
  maxTokens: number;
}): Promise<T> {
  const { key, baseUrl } = openRouterCreds();
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  const model = opts.model || process.env.COWORK_MODEL || "google/gemini-2.5-flash";

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
  recordChat(data, res.url);
  return parseJSON<T>(data.choices?.[0]?.message?.content, "OpenRouter");
}
