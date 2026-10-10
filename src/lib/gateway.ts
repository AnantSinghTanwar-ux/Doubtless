/**
 * Optional OpenAI-compatible gateway (e.g. cheaperinference.com), meant for the DEPLOYED site only.
 * It is used first when configured and the app runs on a host (Vercel); on a developer machine it stays off unless
 * AI_GATEWAY_LOCAL=1, so local work keeps using the local model and never spends gateway credit.
 * Any failure (empty wallet, bad key, outage) falls through to the next provider.
 */
import { recordAiCall } from "./usage";

const BASE_URL = (process.env.OPENAI_BASE_URL || "").replace(/\/$/, "");
const TEXT_MODELS = [...new Set([process.env.OPENAI_MODEL, "gemini-2.5-flash"].filter(Boolean) as string[])];
const VISION_MODELS = [...new Set([process.env.OPENAI_VISION_MODEL, "gemini-2.5-flash"].filter(Boolean) as string[])];
const TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS) || 40_000;

export type GatewayContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

/** After a billing or auth failure, stop trying for a while so every request doesn't pay for a doomed round trip. */
let pausedUntil = 0;

/** Models the gateway said it doesn't have: skipped for the rest of this server's life, so a wrong OPENAI_MODEL costs one failed call, not one per request. */
const unavailable = new Set<string>();

export function gatewayEnabled(): boolean {
  if (!process.env.OPENAI_API_KEY || !BASE_URL) return false;
  if (Date.now() < pausedUntil) return false;
  return !!process.env.VERCEL || process.env.AI_GATEWAY_LOCAL === "1";
}

class GatewayError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
  }
}

async function callOnce(model: string, system: string | undefined, user: GatewayContent, opts: { json?: boolean; maxTokens: number; temperature: number }): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: user }],
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let code = "";
    let message = body.replace(/\s+/g, " ").slice(0, 160);
    try {
      const e = JSON.parse(body).error;
      code = String(e?.code ?? "");
      message = String(e?.message ?? message);
    } catch {}
    throw new GatewayError(`Gateway ${res.status} (${model}): ${message}`, res.status, code);
  }
  const data = await res.json();
  recordAiCall({ provider: "gateway", model, inTokens: data.usage?.prompt_tokens, outTokens: data.usage?.completion_tokens });
  const text: string | undefined = data.choices?.[0]?.message?.content;
  if (!text?.trim()) throw new Error(`Gateway (${model}) returned an empty reply`);
  return text;
}

export async function gatewayChat(opts: { system?: string; user: GatewayContent; json?: boolean; vision?: boolean; maxTokens?: number; temperature?: number }): Promise<string> {
  if (!gatewayEnabled()) throw new Error("Gateway is not enabled");
  let lastError: unknown;
  const candidates = (opts.vision ? VISION_MODELS : TEXT_MODELS).filter((m) => !unavailable.has(m));
  for (const model of candidates) {
    try {
      return await callOnce(model, opts.system, opts.user, { json: opts.json, maxTokens: opts.maxTokens ?? 2500, temperature: opts.temperature ?? 0.4 });
    } catch (err) {
      lastError = err;
      if (err instanceof GatewayError) {
        // Empty wallet or rejected key: pause the gateway, and don't bother trying another model.
        if (err.code === "insufficient_balance" || err.status === 401 || err.status === 402 || err.status === 403) {
          pausedUntil = Date.now() + 10 * 60_000;
          console.warn("[gateway] paused for 10 minutes:", err.message);
          break;
        }
        // An unknown/unavailable model name: try the next model in the list.
        if (err.status === 404 || err.code === "not_found" || err.code === "model_not_found") {
          unavailable.add(model);
          console.warn(`[gateway] model ${model} is not available; skipping it from now on. Set OPENAI_MODEL to one your gateway offers.`);
          continue;
        }
      }
      break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gateway request failed");
}
