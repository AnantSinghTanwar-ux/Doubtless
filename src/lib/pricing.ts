/**
 * AI price list, in US dollars per 1M tokens (or per minute for voice). Used for the cost shown on every AI answer, the
 * admin usage page and the business model page. List prices change: check the providers' pages and override any entry
 * with AI_PRICES_JSON, e.g. {"gateway:gemini-2.5-flash":{"in":0.2,"out":1.62}}.
 *
 * Two numbers are tracked for every call:
 *   billed - what we actually pay for this call (a local model or free credits cost $0)
 *   market - what the same call would cost on the reference cloud model, i.e. the cost at scale without our own hardware
 */
export interface Price {
  /** $ per 1M input tokens */
  in: number;
  /** $ per 1M output tokens */
  out: number;
  /** $ per minute, for voice */
  perMinute?: number;
  /** False when the call costs us nothing (local model, free credits). */
  billed: boolean;
  note: string;
}

/** The cloud model a call is compared against for the "market" cost (cheapest strong option we have a key for). */
export const REFERENCE_KEY = "gateway:gemini-2.5-flash";

const DEFAULTS: Record<string, Price> = {
  "gateway:gemini-2.5-flash": { in: 0.2, out: 1.62, billed: true, note: "cheaperinference.com list price" },
  "gateway:*": { in: 0.2, out: 1.62, billed: true, note: "gateway, assumed gemini-2.5-flash rate" },
  "gemini:gemini-2.5-flash": { in: 0.3, out: 2.5, billed: true, note: "Google AI Studio list price" },
  "gemini:gemini-2.5-pro": { in: 1.25, out: 10, billed: true, note: "Google AI Studio list price" },
  "gemini:text-embedding-004": { in: 0.02, out: 0, billed: true, note: "embedding" },
  "gemini:*": { in: 0.3, out: 2.5, billed: true, note: "Gemini, assumed 2.5 Flash rate" },
  "openrouter:*": { in: 3, out: 15, billed: true, note: "OpenRouter, Sonnet-class rate" },
  "nvidia:*": { in: 0, out: 0, billed: false, note: "NVIDIA NIM free trial credits" },
  "nvidia-embed:*": { in: 0, out: 0, billed: false, note: "NVIDIA NIM free trial credits" },
  "ollama:*": { in: 0, out: 0, billed: false, note: "your own hardware" },
  "vapi:voice": { in: 0, out: 0, perMinute: 0.06, billed: true, note: "Vapi voice, measured ~$0.057/min" },
};

let overrides: Record<string, Partial<Price>> = {};
try {
  overrides = JSON.parse(process.env.AI_PRICES_JSON || "{}");
} catch {}

export function priceFor(provider: string, model: string): Price {
  const exact = `${provider}:${model}`;
  const base = DEFAULTS[exact] ?? DEFAULTS[`${provider}:*`] ?? { in: 0, out: 0, billed: false, note: "unpriced" };
  return { ...base, ...(overrides[exact] ?? overrides[`${provider}:*`] ?? {}) };
}

const perToken = (p: Price, inTok: number, outTok: number) => (inTok * p.in + outTok * p.out) / 1_000_000;

export function costOf(provider: string, model: string, inTokens: number, outTokens: number, minutes = 0): { billed: number; market: number } {
  const p = priceFor(provider, model);
  const own = perToken(p, inTokens, outTokens) + minutes * (p.perMinute ?? 0);
  // Voice has no cheaper reference; text compares against the reference cloud model, embeddings against a cloud embedding model.
  const ref = /embed/i.test(model) || provider.endsWith("-embed") ? priceFor("gemini", "text-embedding-004") : priceFor(...(REFERENCE_KEY.split(":") as [string, string]));
  const market = minutes > 0 ? own : perToken(ref, inTokens, outTokens);
  return { billed: p.billed ? own : 0, market: Math.max(market, p.billed ? own : 0) };
}
