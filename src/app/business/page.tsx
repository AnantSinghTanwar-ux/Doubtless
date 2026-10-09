import Link from "next/link";
import type { Metadata } from "next";
import { costOf, priceFor, REFERENCE_KEY } from "@/lib/pricing";

export const metadata: Metadata = { title: "Business model & API costs · Sθlvε", description: "What every AI call costs and how Sθlvε scales." };

/**
 * Unit economics, computed from the same price list the app uses to bill every call (src/lib/pricing.ts), so the
 * numbers here move when prices change. Token counts are per call, measured on real requests and rounded up ~1.5x for
 * the longer answers cloud models write.
 */
const [REF_PROVIDER, REF_MODEL] = REFERENCE_KEY.split(":");
const FEATURES = [
  { name: "Doubt routing (why is the student stuck?)", key: "doubt.route", inTok: 700, outTok: 200 },
  { name: "AI explanation of a doubt", key: "doubt.explain", inTok: 1200, outTok: 900 },
  { name: "Search the student's notes (RAG lookup)", key: "vault.search", inTok: 60, outTok: 0, embed: true },
  { name: "Practice set (5 questions)", key: "practice", inTok: 700, outTok: 1200 },
  { name: "Answer check (photo of handwritten work)", key: "solve", inTok: 1800, outTok: 600 },
  { name: "CoWork: one PDF page explained + highlighted", key: "cowork.page", inTok: 2200, outTok: 900 },
  { name: "CoWork: whole-document study guide", key: "cowork.study-guide", inTok: 14000, outTok: 6000 },
  { name: "Viva: one examiner question", key: "viva.question", inTok: 800, outTok: 250 },
  { name: "Viva: final report", key: "viva.report", inTok: 2500, outTok: 900 },
  { name: "Teacher session summary", key: "session.summary", inTok: 1500, outTok: 500 },
  { name: "Indexing a 40-page PDF (one time)", key: "vault.index", inTok: 24000, outTok: 0, embed: true },
];
const cloud = (inTok: number, outTok: number, embed?: boolean) =>
  embed ? (inTok * priceFor("gemini", "text-embedding-004").in) / 1e6 : costOf(REF_PROVIDER, REF_MODEL, inTok, outTok).billed;
const VOICE_MIN = priceFor("vapi", "voice").perMinute ?? 0.06;

/** What a typical active student does in a month. */
const MONTH = [
  { what: "doubts asked (route + explanation + notes lookup)", n: 100, each: cloud(700, 200) + cloud(1200, 900) + cloud(60, 0, true) },
  { what: "practice sets", n: 20, each: cloud(700, 1200) },
  { what: "answer checks", n: 15, each: cloud(1800, 600) },
  { what: "CoWork pages read (cached after the first time)", n: 120, each: cloud(2200, 900) },
  { what: "study guides", n: 4, each: cloud(14000, 6000) },
  { what: "vivas (10 questions + report)", n: 4, each: 10 * cloud(800, 250) + cloud(2500, 900) },
  { what: "PDFs uploaded and indexed", n: 6, each: cloud(24000, 0, true) },
];
const textMonth = MONTH.reduce((s, m) => s + m.n * m.each, 0);
const FIREBASE_PER_STUDENT = 0.02; // ~30k reads + 3k writes a month on Blaze ($0.06/100k reads, $0.18/100k writes) + storage
const HOSTING_PER_STUDENT = 0.01; // Vercel Pro $20/mo shared over a few thousand students

const PLANS = [
  { name: "Free", price: 0, voice: 0, note: "10 doubts / day, 20 CoWork pages / month, practice. No voice tutor.", textShare: 0.3 },
  { name: "Student Pro", price: 3.6, voice: 15, note: "₹299 / month. Unlimited text features + 15 voice-tutor minutes.", textShare: 1 },
  { name: "Exam Sprint", price: 8.4, voice: 60, note: "₹699 / month in exam season. 1 hour of voice + priority teachers.", textShare: 1.5 },
];

const usd = (n: number, d = 4): string => (n < 0 ? `-${usd(-n, d)}` : n >= 1 ? `$${n.toLocaleString("en-US", { minimumFractionDigits: Math.min(d, 2), maximumFractionDigits: Math.min(d, 2) })}` : `$${n.toFixed(d)}`);

function Table({ head, rows, foot }: { head: string[]; rows: (string | number)[][]; foot?: (string | number)[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-sheet">
      <table className="w-full text-sm">
        <thead className="bg-paper text-left text-xs uppercase tracking-wider text-muted">
          <tr>{head.map((h, i) => <th key={h} className={`px-3 py-2 font-medium ${i ? "text-right" : ""}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) => <td key={j} className={`px-3 py-2 text-ink ${j ? "tabular text-right" : ""}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot>
            <tr className="border-t-2 border-line font-semibold">{foot.map((c, j) => <td key={j} className={`px-3 py-2 text-ink ${j ? "tabular text-right" : ""}`}>{c}</td>)}</tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export default function BusinessPage() {
  const ref = priceFor(REF_PROVIDER, REF_MODEL);
  const plans = PLANS.map((p) => {
    const cost = textMonth * p.textShare + p.voice * VOICE_MIN + FIREBASE_PER_STUDENT + HOSTING_PER_STUDENT;
    return { ...p, cost, margin: p.price ? (p.price - cost) / p.price : null };
  });
  const scale = [1_000, 10_000, 100_000].map((n) => {
    // 85% free, 13% Pro, 2% Exam Sprint; teacher sessions earn a 20% commission on top (not counted here).
    const mix = [0.85, 0.13, 0.02];
    const revenue = n * mix.reduce((s, m, i) => s + m * plans[i].price, 0);
    const cost = n * mix.reduce((s, m, i) => s + m * plans[i].cost, 0);
    return { n, revenue, cost, profit: revenue - cost };
  });

  return (
    <main id="main" className="mx-auto max-w-5xl space-y-10 px-4 py-10 md:py-14">
      <header>
        <Link href="/" className="text-sm text-muted hover:text-ink">← Sθlvε</Link>
        <h1 className="display mt-3 text-3xl text-ink md:text-4xl">Business model &amp; API costs</h1>
        <p className="mt-3 max-w-3xl text-muted">
          Every AI call in Sθlvε is priced and logged per user (admins see it under <i>AI Usage &amp; Costs</i>, students see the last call&apos;s cost at
          the bottom of each page). Below is what each call costs on a paid cloud model, {REF_MODEL} at ${ref.in} / ${ref.out} per million input / output
          tokens, plus voice at ${VOICE_MIN}/min. In development we run a local model (Ollama) and free NVIDIA credits, so our real bill today is close to $0.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">Cost of each AI call</h2>
        <Table
          head={["Call", "Input tokens", "Output tokens", "Cost", "Per 1,000 calls"]}
          rows={[
            ...FEATURES.map((f) => {
              const c = cloud(f.inTok, f.outTok, f.embed);
              return [f.name, f.inTok.toLocaleString(), f.outTok.toLocaleString(), usd(c, 5), usd(c * 1000, 2)];
            }),
            ["Voice tutor, per minute (Vapi: speech-to-text + model + voice)", "-", "-", usd(VOICE_MIN, 3), usd(VOICE_MIN * 1000, 2)],
          ]}
        />
        <p className="text-xs text-faint">
          CoWork results are cached for 7 days and shared across devices, so re-opening a document costs nothing. A doubt that the router sends to a teacher or to
          practice skips the explanation call.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">One active student, one month</h2>
        <Table
          head={["Activity", "Times", "Cost each", "Monthly"]}
          rows={MONTH.map((m) => [m.what, m.n, usd(m.each, 5), usd(m.n * m.each)])}
          foot={["All text AI features", "", "", usd(textMonth)]}
        />
        <p className="text-sm text-muted">
          Text AI costs about <b className="text-ink">{usd(textMonth, 2)}</b> per heavy student per month. Voice is the expensive part: 30 minutes is{" "}
          <b className="text-ink">{usd(30 * VOICE_MIN, 2)}</b>, which is why voice is only in paid plans and is the main lever on price. Free users are kept cheap with daily caps and a smaller model.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">Proposed plans and margin</h2>
        <Table
          head={["Plan", "Price / month", "AI + infra cost", "Gross margin"]}
          rows={plans.map((p) => [`${p.name}: ${p.note}`, usd(p.price, 2), usd(p.cost, 2), p.margin === null ? "funded by paid plans" : `${Math.round(p.margin * 100)}%`])}
        />
        <p className="text-sm text-muted">
          Second revenue line: live teacher sessions, where Sθlvε keeps a 20% commission. Teachers bring their own time, so it has almost no AI cost (one
          summary per session, {usd(cloud(1500, 500), 4)}).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">At scale (85% free, 13% Pro, 2% Exam Sprint)</h2>
        <Table
          head={["Monthly active students", "Revenue", "AI + infra cost", "Gross profit"]}
          rows={scale.map((s) => [s.n.toLocaleString(), usd(s.revenue, 0), usd(s.cost, 0), usd(s.profit, 0)])}
        />
      </section>

      <section className="space-y-2 text-sm text-muted">
        <h2 className="font-display text-xl font-semibold text-ink">Why the costs stay low as we grow</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>A cheap router decides first; the expensive explanation only runs when it is needed.</li>
          <li>Answers are grounded in the student&apos;s own notes through retrieval, so prompts stay short instead of pasting whole PDFs.</li>
          <li>CoWork page notes and study guides are generated once and cached for 7 days for every device.</li>
          <li>Providers are swappable (local Ollama, NVIDIA, Gemini, any OpenAI-compatible gateway) with automatic fallback, so we can always buy the cheapest capable model.</li>
          <li>Usage is metered per user and per feature from day one, so free-tier limits and abuse are easy to enforce.</li>
        </ul>
      </section>
    </main>
  );
}
