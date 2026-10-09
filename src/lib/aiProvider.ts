import { GoogleGenAI } from "@google/genai";
import { nvidiaChat, nvidiaConfigured, withJsonInstruction, type NvidiaContent } from "./nvidia";

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
const localProviderUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

const ollamaModel = process.env.OLLAMA_MODEL || "llama3.2";
const ollamaEmbedModel = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const ollamaVisionModel = process.env.OLLAMA_VISION_MODEL || "llava";

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
  const nvidiaJSON = async () => parseJSON<T>(await nvidiaChat({ system: withJsonInstruction(systemPrompt), user: prompt, maxTokens: 3000 }), "NVIDIA");
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
    const key = process.env.OPENROUTER_API_KEY;
    // useHighEnd already tried OpenRouter inside the primary path.
    if (!key || useHighEnd) throw primaryError;
    console.warn("[aiProvider] trying OpenRouter:", primaryError instanceof Error ? primaryError.message : primaryError);
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const openRouterModel = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-5.5";

  if (useHighEnd && openRouterKey) {
    console.log(`[aiProvider] Routing to OpenRouter API (${openRouterModel}) for high-end task`);
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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

  if (useLocalProvider) {
    console.log(`[aiProvider] Routing to local Ollama API (${ollamaModel}) at ${localProviderUrl}`);
    const res = await fetch(`${localProviderUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        prompt,
        system: systemPrompt,
        format: "json",
        stream: false,
        options: { num_ctx: 16384 },
      }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Ollama error ${res.status}: ${errorText}`);
    }
    const data = await res.json();
    return parseJSON<T>(data.response, "Ollama");
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
  if (useLocalProvider) {
    const res = await fetch(`${localProviderUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        prompt,
        system: systemPrompt,
        stream: false,
        options: { num_ctx: 16384 },
      }),
    });
    if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`);
    const data = await res.json();
    return data.response;
  }

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
  if (useLocalProvider) {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const res = await fetch(`${localProviderUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaVisionModel,
        prompt,
        system: systemPrompt,
        images: [base64Data],
        stream: false,
        format: "json",
      }),
    });
    if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`);
    const data = await res.json();
    return data.response;
  }

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

export async function embedText(text: string): Promise<number[]> {
  if (useLocalProvider) {
    const res = await fetch(`${localProviderUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaEmbedModel,
        prompt: text,
      }),
    });
    if (!res.ok) throw new Error(`Ollama embedding error: ${res.statusText}`);
    const data = await res.json();
    return data.embedding;
  }

  const model = getEmbedModel();
  const response = await genai.models.embedContent({
    model,
    contents: text,
  });
  return response.embeddings?.[0]?.values ?? [];
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const results: number[][] = [];
  for (const text of texts) {
    const embedding = await embedText(text);
    results.push(embedding);
  }
  return results;
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
  const nvidiaAttempt: [string, () => Promise<T>] = ["NVIDIA", () => nvidiaMultimodalJSON<T>(opts)];
  if (preferNvidia && nvidiaConfigured()) attempts.push(nvidiaAttempt);
  if (process.env.OPENROUTER_API_KEY) attempts.push(["OpenRouter", () => openRouterRequest<T>(opts)]);
  if (process.env.GEMINI_API_KEY) attempts.push(["Gemini", () => geminiMultimodalJSON<T>(opts)]);
  if (!preferNvidia && nvidiaConfigured()) attempts.push(nvidiaAttempt);
  if (useLocalProvider) attempts.push(["Ollama (text only)", () => ollamaTextJSON<T>(opts)]);
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
  const hasImages = opts.content.some((c) => c.type === "image_url");
  const text = await nvidiaChat({
    system: withJsonInstruction(opts.system),
    user: opts.content as NvidiaContent,
    vision: hasImages,
    maxTokens: Math.max(opts.maxTokens, 1500),
  });
  return parseJSON<T>(text, "NVIDIA");
}

/** Last resort on a machine with a local model: text parts only, since the default model can't see images. */
async function ollamaTextJSON<T>(opts: { system: string; content: OpenRouterContent[] }): Promise<T> {
  const prompt = opts.content.map((c) => (c.type === "text" ? c.text : "")).filter(Boolean).join("\n");
  const res = await fetch(`${localProviderUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: ollamaModel, prompt, system: opts.system, format: "json", stream: false, options: { num_ctx: 16384 } }),
  });
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
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  const model = opts.model || process.env.COWORK_MODEL || "google/gemini-2.5-flash";

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
