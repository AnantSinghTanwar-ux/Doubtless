import { AsyncLocalStorage } from "async_hooks";
import { after, type NextRequest } from "next/server";
import { doc, increment, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { costOf } from "./pricing";

/**
 * Per-request AI usage ledger. Every AI call made while a route runs is recorded here, priced, attributed to the
 * signed-in user and the feature, returned to the browser in response headers, and added to a daily per-user rollup
 * in Firestore (aiUsage/{uid}__{date}). One small write per request.
 */
export interface AiCall {
  provider: string;
  model: string;
  inTokens: number;
  outTokens: number;
  minutes: number;
  billed: number;
  market: number;
}

interface Ctx {
  uid: string;
  email: string;
  feature: string;
  calls: AiCall[];
}

const store = new AsyncLocalStorage<Ctx>();

/** Called by the AI layer after each provider call. Outside a tracked request it does nothing. */
export function recordAiCall(c: { provider: string; model: string; inTokens?: number; outTokens?: number; minutes?: number }) {
  const ctx = store.getStore();
  if (!ctx) return;
  const inTokens = Math.max(0, Math.round(c.inTokens ?? 0));
  const outTokens = Math.max(0, Math.round(c.outTokens ?? 0));
  const minutes = Math.max(0, c.minutes ?? 0);
  const { billed, market } = costOf(c.provider, c.model, inTokens, outTokens, minutes);
  ctx.calls.push({ provider: c.provider, model: c.model, inTokens, outTokens, minutes, billed, market });
}

/** The signed-in user of the current request (inside a withUsage route), or "anonymous". Verified from their ID token. */
export function currentUser(): { uid: string; email: string } {
  const ctx = store.getStore();
  return ctx ? { uid: ctx.uid, email: ctx.email } : { uid: "anonymous", email: "" };
}

/** Rough token count for providers that don't report one (about four characters per token). */
export const estimateTokens = (text: string) => Math.ceil((text?.length ?? 0) / 4);

/* Signed-in user, from the Firebase ID token the browser sends. Verified once per token and remembered for its lifetime. */
const tokenCache = new Map<string, { uid: string; email: string; exp: number }>();

async function identify(request: NextRequest): Promise<{ uid: string; email: string }> {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return { uid: "anonymous", email: "" };
  const hit = tokenCache.get(token);
  if (hit && hit.exp > Date.now()) return hit;
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
      cache: "no-store",
    });
    const user = res.ok ? (await res.json()).users?.[0] : null;
    if (!user?.localId) return { uid: "anonymous", email: "" };
    const who = { uid: user.localId as string, email: String(user.email || "").toLowerCase(), exp: Date.now() + 50 * 60_000 };
    if (tokenCache.size > 500) tokenCache.clear();
    tokenCache.set(token, who);
    return who;
  } catch {
    return { uid: "anonymous", email: "" };
  }
}

const safeKey = (s: string) => s.replace(/[.\/\[\]*`~]/g, "_").slice(0, 80);

async function persist(ctx: Ctx) {
  if (ctx.calls.length === 0) return;
  const day = new Date().toISOString().slice(0, 10);
  const sum = (k: keyof AiCall) => ctx.calls.reduce((n, c) => n + (c[k] as number), 0);
  // Total per provider/model within this request, then one increment per field.
  const totals = new Map<string, { calls: number; inTokens: number; outTokens: number; billed: number; market: number; minutes: number }>();
  for (const c of ctx.calls) {
    const key = safeKey(`${c.provider}:${c.model}`);
    const t = totals.get(key) ?? { calls: 0, inTokens: 0, outTokens: 0, billed: 0, market: 0, minutes: 0 };
    totals.set(key, { calls: t.calls + 1, inTokens: t.inTokens + c.inTokens, outTokens: t.outTokens + c.outTokens, billed: t.billed + c.billed, market: t.market + c.market, minutes: t.minutes + c.minutes });
  }
  const providerUpdates = Object.fromEntries(
    [...totals].map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([f, n]) => [f, increment(n)]))])
  );
  try {
    await setDoc(
      doc(db, "aiUsage", `${safeKey(ctx.uid)}__${day}`),
      {
        uid: ctx.uid,
        email: ctx.email,
        date: day,
        requests: increment(1),
        calls: increment(ctx.calls.length),
        inTokens: increment(sum("inTokens")),
        outTokens: increment(sum("outTokens")),
        billed: increment(sum("billed")),
        market: increment(sum("market")),
        minutes: increment(sum("minutes")),
        features: { [safeKey(ctx.feature)]: { requests: increment(1), billed: increment(sum("billed")), market: increment(sum("market")) } },
        providers: providerUpdates,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("[usage] could not save:", err instanceof Error ? err.message : err);
  }
}

/** Wraps a route handler: tracks every AI call it makes, reports the cost in headers, and saves the daily rollup. */
export function withUsage<A extends unknown[]>(feature: string, handler: (request: NextRequest, ...rest: A) => Promise<Response>) {
  return async (request: NextRequest, ...rest: A): Promise<Response> => {
    const who = await identify(request);
    const ctx: Ctx = { ...who, feature, calls: [] };
    const res = await store.run(ctx, () => handler(request, ...rest));
    if (ctx.calls.length) {
      const billed = ctx.calls.reduce((n, c) => n + c.billed, 0);
      const market = ctx.calls.reduce((n, c) => n + c.market, 0);
      const tokens = ctx.calls.reduce((n, c) => n + c.inTokens + c.outTokens, 0);
      try {
        res.headers.set("X-AI-Cost-USD", billed.toFixed(6));
        res.headers.set("X-AI-Market-USD", market.toFixed(6));
        res.headers.set("X-AI-Tokens", String(tokens));
        res.headers.set("X-AI-Calls", String(ctx.calls.length));
        res.headers.set("X-AI-Providers", [...new Set(ctx.calls.map((c) => `${c.provider}:${c.model}`))].join(",").slice(0, 300));
        res.headers.set("X-AI-Feature", feature);
      } catch {
        /* immutable headers: the cost still gets saved below */
      }
      after(() => persist(ctx));
    }
    return res;
  };
}
