"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { authedJSON } from "@/lib/apiClient";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import Loader from "@/components/ui/Loader";
import { cn } from "@/lib/utils";

interface Row {
  key?: string;
  uid?: string;
  email?: string;
  name?: string;
  role?: string;
  lastDate?: string;
  topFeature?: string;
  date?: string;
  requests?: number;
  calls?: number;
  inTokens?: number;
  outTokens?: number;
  billed?: number;
  market?: number;
  minutes?: number;
}
interface Report {
  days: number;
  since: string;
  totals: Row & { users: number };
  users: Row[];
  providers: Row[];
  features: Row[];
  byDay: Row[];
}

const usd = (n = 0) => (n === 0 ? "$0" : n < 0.01 ? `$${n.toFixed(5)}` : `$${n.toFixed(2)}`);
const num = (n = 0) => n.toLocaleString();
/** Feature keys are stored with "_" for "." (Firestore field names can't contain dots). */
const feature = (k = "") => k.replace(/_/g, ".");
const PROVIDER_NOTE: Record<string, string> = {
  ollama: "local, $0",
  nvidia: "NVIDIA_API_KEY (free credits)",
  "nvidia-embed": "NVIDIA_API_KEY (free credits)",
  gateway: "OPENAI_API_KEY (gateway)",
  gemini: "GEMINI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  vapi: "Vapi key (per minute)",
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-sheet p-4">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="tabular mt-1 font-display text-2xl font-semibold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-sheet">
      <table className="w-full text-sm">
        <thead className="bg-paper text-left text-xs uppercase tracking-wider text-muted">
          <tr>{head.map((h, i) => <th key={h} className={cn("px-3 py-2 font-medium", i > 0 && "text-right")}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={head.length} className="px-3 py-6 text-center text-muted">No AI usage recorded in this period.</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) => <td key={j} className={cn("px-3 py-2 text-ink", j > 0 && "tabular text-right")}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Admin: who uses the AI, which provider (API key) it runs on, and what it costs. */
export default function AdminUsagePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (d: number) =>
      authedJSON<Report>(`/api/admin/usage?days=${d}`)
        .then((r) => (setReport(r), setError(null)))
        .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load usage")),
    []
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) return router.replace("/login");
    void load(days);
  }, [authLoading, user, router, load, days]);

  const t = report?.totals;
  const maxDay = Math.max(0.000001, ...(report?.byDay ?? []).map((d) => d.market ?? 0));

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar />
      <div className="lg:ml-64">
        <TopBar title="AI Usage & Costs" />
        <main id="main" className="mx-auto max-w-7xl space-y-8 p-4 pb-16 md:p-6">
          {error && /admins only/i.test(error) ? (
            <div className="mx-auto mt-16 max-w-md text-center">
              <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-rose-400" />
              <p className="text-lg font-semibold text-ink">Admins only</p>
            </div>
          ) : error ? (
            <p className="text-sm text-rose-500">{error}</p>
          ) : !report || !t ? (
            <div className="flex justify-center py-24"><Loader size="lg" /></div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  Every AI call, priced and attributed to the user who made it (days are UTC). <b>Paid</b> is what we actually spend (local models and free credits are $0);{" "}
                  <b>at cloud prices</b> is what the same usage would cost on Gemini 2.5 Flash, i.e. the cost at scale.
                </p>
                <div className="flex gap-1 rounded-lg border border-line p-1">
                  {[1, 7, 30, 90].map((d) => (
                    <button key={d} onClick={() => setDays(d)} className={cn("rounded-md px-3 py-1 text-sm", d === days ? "bg-ink text-snow" : "text-muted hover:text-ink")}>
                      {d === 1 ? "Today" : `${d}d`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Stat label="Paid" value={usd(t.billed)} hint={`last ${days} day${days === 1 ? "" : "s"}`} />
                <Stat label="At cloud prices" value={usd(t.market)} />
                <Stat label="AI requests" value={num(t.requests)} hint={`${num(t.calls)} model calls`} />
                <Stat label="Tokens" value={num((t.inTokens ?? 0) + (t.outTokens ?? 0))} hint={`${num(t.inTokens)} in / ${num(t.outTokens)} out`} />
                <Stat label="Active users" value={num(t.users)} hint={t.users ? `${usd((t.market ?? 0) / t.users)} per user at cloud prices` : undefined} />
              </div>

              {report.byDay.length > 1 && (
                <section>
                  <h2 className="mb-3 font-display text-lg font-semibold text-ink">Daily cost (cloud prices)</h2>
                  <div className="flex h-28 items-end gap-1 rounded-xl border border-line bg-sheet p-3">
                    {report.byDay.map((d) => (
                      <div key={d.date} title={`${d.date}: ${usd(d.market)} (${num(d.requests)} requests)`} className="flex-1 rounded-t bg-pen/70" style={{ height: `${Math.max(3, ((d.market ?? 0) / maxDay) * 100)}%` }} />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h2 className="mb-3 font-display text-lg font-semibold text-ink">Users by AI spend</h2>
                <Table
                  head={["User", "Requests", "Tokens", "Voice min", "Paid", "At cloud prices", "Most used", "Last active"]}
                  rows={report.users.map((u) => [
                    u.uid === "anonymous" ? "Signed-out visitors" : `${u.name || u.email || u.uid}${u.role ? ` (${u.role})` : ""}${u.name && u.email ? ` · ${u.email}` : ""}`,
                    num(u.requests),
                    num((u.inTokens ?? 0) + (u.outTokens ?? 0)),
                    (u.minutes ?? 0).toFixed(1),
                    usd(u.billed),
                    usd(u.market),
                    feature(u.topFeature),
                    u.lastDate ?? "",
                  ])}
                />
              </section>

              <div className="grid gap-8 lg:grid-cols-2">
                <section>
                  <h2 className="mb-3 font-display text-lg font-semibold text-ink">By provider / API key</h2>
                  <Table
                    head={["Provider · model", "Calls", "Tokens", "Paid", "Cloud"]}
                    rows={report.providers.map((p) => {
                      const [prov, ...m] = (p.key ?? "").split(":");
                      return [`${prov} · ${m.join(":")} (${PROVIDER_NOTE[prov] ?? "key"})`, num(p.calls), num((p.inTokens ?? 0) + (p.outTokens ?? 0)), usd(p.billed), usd(p.market)];
                    })}
                  />
                </section>
                <section>
                  <h2 className="mb-3 font-display text-lg font-semibold text-ink">By feature</h2>
                  <Table
                    head={["Feature", "Requests", "Paid", "Cloud", "Cloud / request"]}
                    rows={report.features.map((f) => [feature(f.key), num(f.requests), usd(f.billed), usd(f.market), usd((f.market ?? 0) / Math.max(1, f.requests ?? 0))])}
                  />
                </section>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
