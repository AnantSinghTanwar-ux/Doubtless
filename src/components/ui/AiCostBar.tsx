"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { getCost, installAiCostTracking, subscribeCost } from "@/lib/aiCostClient";

const usd = (n: number) => (n === 0 ? "$0" : n < 0.01 ? `$${n.toFixed(5)}` : `$${n.toFixed(3)}`);
const SERVER = { last: null, billed: 0, market: 0, calls: 0 };

/** A tiny line at the very bottom of every page: what the last AI answer cost, and this session's total. */
export default function AiCostBar() {
  useEffect(() => installAiCostTracking(), []);
  const c = useSyncExternalStore(subscribeCost, getCost, () => SERVER);

  return (
    <footer className="px-4 pb-20 pt-6 text-center text-[11px] leading-5 text-faint lg:pb-4">
      {c.last ? (
        <>
          AI cost · last answer {usd(c.last.billed)} ({c.last.tokens.toLocaleString()} tokens, {c.last.providers.split(",")[0]?.replace(":", " ")}
          {c.last.billed === 0 && c.last.market > 0 ? `; ${usd(c.last.market)} at cloud prices` : ""}) · this session {usd(c.billed)} over {c.calls} call
          {c.calls === 1 ? "" : "s"}
        </>
      ) : (
        <>AI costs are shown here after each answer.</>
      )}{" "}
      · <Link href="/business" className="underline underline-offset-2 hover:text-muted">Business model &amp; API costs</Link>
    </footer>
  );
}
