import { NextRequest, NextResponse } from "next/server";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { authErrorResponse, requireAdmin } from "@/lib/serverAuth";

type Num = Record<string, number>;
interface Rollup {
  uid: string;
  email: string;
  date: string;
  requests?: number;
  calls?: number;
  inTokens?: number;
  outTokens?: number;
  billed?: number;
  market?: number;
  minutes?: number;
  features?: Record<string, Num>;
  providers?: Record<string, Num>;
}

const add = (into: Num, from: Num | undefined, keys: string[]) => keys.forEach((k) => (into[k] = (into[k] ?? 0) + (from?.[k] ?? 0)));
const FIELDS = ["requests", "calls", "inTokens", "outTokens", "billed", "market", "minutes"];

/** AI usage and cost for the last N days: totals, per user, per provider (API key), per feature and per day. */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const days = Math.min(90, Math.max(1, Number(request.nextUrl.searchParams.get("days")) || 30));
    const since = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);

    const [snap, usersSnap] = await Promise.all([getDocs(query(collection(db, "aiUsage"), where("date", ">=", since))), getDocs(collection(db, "users"))]);
    const names = new Map(usersSnap.docs.map((d) => [d.id, { name: String(d.data().displayName ?? ""), role: String(d.data().role ?? "") }]));

    const totals: Num = {};
    const users = new Map<string, Num>();
    const userMeta = new Map<string, { email: string; lastDate: string; features: Num }>();
    const providers = new Map<string, Num>();
    const features = new Map<string, Num>();
    const byDay = new Map<string, Num>();

    for (const d of snap.docs) {
      const r = d.data() as Rollup;
      add(totals, r as unknown as Num, FIELDS);
      const u = users.get(r.uid) ?? {};
      add(u, r as unknown as Num, FIELDS);
      users.set(r.uid, u);
      const meta = userMeta.get(r.uid) ?? { email: r.email, lastDate: r.date, features: {} };
      if (r.date > meta.lastDate) meta.lastDate = r.date;
      if (!meta.email && r.email) meta.email = r.email;
      for (const [f, v] of Object.entries(r.features ?? {})) meta.features[f] = (meta.features[f] ?? 0) + (v.market ?? 0);
      userMeta.set(r.uid, meta);
      for (const [k, v] of Object.entries(r.providers ?? {})) {
        const p = providers.get(k) ?? {};
        add(p, v, ["calls", "inTokens", "outTokens", "billed", "market", "minutes"]);
        providers.set(k, p);
      }
      for (const [k, v] of Object.entries(r.features ?? {})) {
        const f = features.get(k) ?? {};
        add(f, v, ["requests", "billed", "market"]);
        features.set(k, f);
      }
      const day = byDay.get(r.date) ?? {};
      add(day, r as unknown as Num, ["requests", "billed", "market"]);
      byDay.set(r.date, day);
    }

    const userRows = [...users].map(([uid, v]) => {
      const meta = userMeta.get(uid)!;
      const top = Object.entries(meta.features).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
      return { market: 0, billed: 0, ...v, uid, email: meta.email, name: names.get(uid)?.name ?? "", role: names.get(uid)?.role ?? "", lastDate: meta.lastDate, topFeature: top };
    });
    userRows.sort((a, b) => (b.market ?? 0) - (a.market ?? 0));

    return NextResponse.json({
      days,
      since,
      totals: { ...totals, users: users.size },
      users: userRows,
      providers: [...providers].map(([key, v]) => ({ market: 0, ...v, key })).sort((a, b) => b.market - a.market),
      features: [...features].map(([key, v]) => ({ market: 0, ...v, key })).sort((a, b) => b.market - a.market),
      byDay: [...byDay].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Usage report error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load usage" }, { status: 500 });
  }
}
