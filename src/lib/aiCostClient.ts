"use client";

import { auth } from "./firebase";

/**
 * Browser side of AI cost tracking. Patches fetch once so that every call to our own /api routes:
 *   - carries the signed-in user's ID token (so usage is attributed to them), and
 *   - reports the AI cost the server put in the response headers into a small session ledger.
 */
export interface CostEntry {
  feature: string;
  billed: number;
  market: number;
  tokens: number;
  providers: string;
  at: number;
}

interface Ledger {
  last: CostEntry | null;
  billed: number;
  market: number;
  calls: number;
}

const KEY = "solve:aiCost";
let ledger: Ledger = { last: null, billed: 0, market: 0, calls: 0 };
try {
  const saved = sessionStorage.getItem(KEY);
  if (saved) ledger = JSON.parse(saved);
} catch {}

const listeners = new Set<() => void>();
export const subscribeCost = (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn));
export const getCost = () => ledger;

function note(res: Response) {
  const billed = Number(res.headers.get("X-AI-Cost-USD"));
  if (!Number.isFinite(billed) || res.headers.get("X-AI-Cost-USD") === null) return;
  const entry: CostEntry = {
    feature: res.headers.get("X-AI-Feature") || "ai",
    billed,
    market: Number(res.headers.get("X-AI-Market-USD")) || 0,
    tokens: Number(res.headers.get("X-AI-Tokens")) || 0,
    providers: res.headers.get("X-AI-Providers") || "",
    at: Date.now(),
  };
  ledger = { last: entry, billed: ledger.billed + entry.billed, market: ledger.market + entry.market, calls: ledger.calls + 1 };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(ledger));
  } catch {}
  listeners.forEach((l) => l());
}

let installed = false;
export function installAiCostTracking() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const ours = url.startsWith("/api/") || url.startsWith(`${location.origin}/api/`);
    if (!ours) return original(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!headers.has("Authorization") && auth.currentUser) {
      try {
        headers.set("Authorization", `Bearer ${await auth.currentUser.getIdToken()}`);
      } catch {}
    }
    const res = await original(input, { ...init, headers });
    note(res);
    return res;
  };
}
