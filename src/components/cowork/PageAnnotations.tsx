"use client";

import type { CSSProperties } from "react";
import type { PageHighlight } from "@/types/cowork";

interface PageAnnotationsProps {
  highlights: PageHighlight[];
  /** Where the page's words are ([ymin, xmin, ymax, xmax], 0-1000); labels are kept off them. Empty for scanned pages. */
  textBoxes?: [number, number, number, number][];
  /** Rendered page size in CSS px. */
  width: number;
  height: number;
}

const PAD = 4;
const STAGGER = 450; // ms between successive highlights

const TAG_STYLE: Record<PageHighlight["kind"], { text: string; bg: string; fallback: string }> = {
  important: { text: "#fff", bg: "#e11d48", fallback: "Exam favourite" },
  definition: { text: "#78350f", bg: "#fcd34d", fallback: "Definition" },
  formula: { text: "#fff", bg: "#c2410c", fallback: "Key formula" },
  keyword: { text: "#fff", bg: "#059669", fallback: "Key term" },
};

const anim = (name: string, ms: number, delay: number, extra = ""): CSSProperties => ({
  animation: `${name} ${ms}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms both${extra ? `, ${extra}` : ""}`,
});

function chipWidth(label: string) {
  return Math.min(200, label.length * 7 + 44);
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
type ChipMode = "right" | "above" | "below";
interface Placement {
  rect: Rect;
  mode: ChipMode;
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Labels are meant to be 1-4 words; a long one ("Key concept in Bayesian linear regression") falls back to the short default. */
const shortLabel = (label: string, fallback: string) => {
  const l = label.trim();
  return l && l.length <= 22 ? l : fallback;
};

/**
 * Picks a spot for every label so it covers neither the page's words, another highlight nor another label: beside the
 * box, above or below it, or out in the page margin. A label with no free spot is left out (its highlight still shows).
 */
function layoutChips(highlights: PageHighlight[], boxes: Rect[], words: Rect[], W: number, H: number): (Placement | null)[] {
  const taken: Rect[] = [];
  const clampX = (x: number, w: number) => Math.min(Math.max(2, x), W - w - 2);
  return highlights.map((h, i) => {
    const b = boxes[i];
    const label = shortLabel(h.label, TAG_STYLE[h.kind].fallback);
    const important = h.kind === "important";
    const w = chipWidth(label) + (important ? 10 : 0);
    const ch = important ? 26 : 18;
    const gap = important ? 28 : 2; // the important chip leaves room for its arrow
    const rows = [b.y + (b.h - ch) / 2, b.y - ch - gap, b.y + b.h + gap];
    const xs = (y: number) =>
      y === rows[0]
        ? [b.x + b.w + (important ? 56 : 6), W - w - 4, 4] // same line: just after the box, or out in the margins
        : [b.x + b.w - w, b.x, b.x + 24, W - w - 4, 4].map((x) => clampX(x, w));
    const fits = (r: Rect) =>
      r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H && !taken.some((t) => overlaps(t, r)) && !boxes.some((o) => overlaps(o, r)) && !words.some((o) => overlaps(o, r));
    for (const y of rows) {
      for (const x of xs(y)) {
        const rect = { x, y, w, h: ch };
        if (!fits(rect)) continue;
        taken.push(rect);
        const mode: ChipMode = x >= b.x + b.w ? "right" : y < b.y ? "above" : y >= b.y + b.h ? "below" : x + w <= b.x ? "right" : "above";
        return { rect, mode };
      }
    }
    return null;
  });
}

/**
 * Animated callouts drawn over a PDF page: marker sweeps, outlined boxes,
 * a pulsing red "!" and an arrow pointing at the most exam-relevant lines.
 * Mount it when the page scrolls into view; remounting replays the animation.
 */
export default function PageAnnotations({ highlights, textBoxes = [], width: W, height: H }: PageAnnotationsProps) {
  const boxes = highlights.map((h) => {
    const [ymin, xmin, ymax, xmax] = h.box;
    return { x: (xmin / 1000) * W - PAD, y: (ymin / 1000) * H - PAD, w: ((xmax - xmin) / 1000) * W + PAD * 2, h: ((ymax - ymin) / 1000) * H + PAD * 2 };
  });
  // Words already inside a highlight don't count as obstacles; a small inset lets labels sit in the gaps between lines.
  const words = textBoxes
    .map(([ymin, xmin, ymax, xmax]) => ({ x: (xmin / 1000) * W, y: (ymin / 1000) * H + 1, w: ((xmax - xmin) / 1000) * W, h: ((ymax - ymin) / 1000) * H - 2 }))
    .filter((r) => r.w > 0 && r.h > 0);
  const chips = layoutChips(highlights, boxes, words, W, H);
  return (
    <div className="cw-anim absolute inset-0 pointer-events-none">
      {highlights.map((h, i) => {
        const { x, y, w, h: hh } = boxes[i];
        const delay = 250 + i * STAGGER;
        const style = TAG_STYLE[h.kind];
        const label = shortLabel(h.label, style.fallback);
        const chip = chips[i];
        return h.kind === "important" ? (
          <ImportantCallout key={i} x={x} y={y} w={w} h={hh} label={label} delay={delay} chip={chip} />
        ) : (
          <div key={i}>
            {h.kind === "definition" && (
              <div
                className="absolute rounded-[3px] mix-blend-multiply"
                style={{ left: x, top: y, width: w, height: hh, background: "rgba(252, 211, 77, 0.55)", ...anim("cw-sweep", 700, delay) }}
              />
            )}
            {h.kind === "formula" && (
              <svg className="absolute overflow-visible" style={{ left: x, top: y }} width={w} height={hh}>
                <rect
                  x={0} y={0} width={w} height={hh} rx={6}
                  fill="rgba(194, 65, 12, 0.08)" stroke="#c2410c" strokeWidth={2} strokeDasharray="1" strokeDashoffset="1" pathLength={1}
                  style={anim("cw-draw", 800, delay)}
                />
              </svg>
            )}
            {h.kind === "keyword" && (
              <div
                className="absolute rounded-full"
                style={{ left: x, top: y + hh - 3, width: w, height: 3, background: "#10b981", ...anim("cw-sweep", 600, delay) }}
              />
            )}
            {chip && (
              <span
                className="absolute whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide shadow-md"
                style={{
                  left: chip.rect.x,
                  top: chip.rect.y,
                  background: style.bg,
                  color: style.text,
                  ...anim("cw-fade-up", 400, delay + 450),
                }}
              >
                {label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ImportantCallout({ x, y, w, h, label, delay, chip }: { x: number; y: number; w: number; h: number; label: string; delay: number; chip: Placement | null }) {
  const ch = 26;

  // The chip goes where layoutChips found room: beside the box, above or below. With no room, only the outline and badge are drawn.
  const chipX = chip?.rect.x ?? 0;
  const chipY = chip?.rect.y ?? 0;
  let from: [number, number], to: [number, number], ctrl: [number, number];
  if (chip?.mode === "right" && chipX + 40 < x) {
    // Chip in the left margin: arrow points right, at the start of the box.
    from = [chipX + (chip.rect.w ?? 0) + 4, chipY + ch / 2];
    to = [x - 6, y + Math.min(h / 2, 16)];
    ctrl = [from[0] + 10, to[1]];
  } else if (chip?.mode === "right") {
    from = [chipX - 4, chipY + ch / 2];
    to = [x + w + 6, y + Math.min(h / 2, 16)];
    ctrl = [from[0] - 10, to[1]];
  } else if (chip?.mode === "above") {
    from = [chipX + 22, chipY + ch + 3];
    to = [chipX + 46, y - 5];
    ctrl = [from[0] - 4, to[1] - 4];
  } else {
    from = [chipX + 22, chipY - 3];
    to = [chipX + 46, y + h + 5];
    ctrl = [from[0] - 4, to[1] + 4];
  }

  const angle = Math.atan2(to[1] - ctrl[1], to[0] - ctrl[0]);
  const head = (a: number) => `${to[0] - 9 * Math.cos(angle + a)},${to[1] - 9 * Math.sin(angle + a)}`;
  const arrowDelay = delay + 650;

  return (
    <>
      {/* Glow + outline drawn around the lines */}
      <svg className="absolute overflow-visible" style={{ left: x, top: y }} width={w} height={h}>
        <rect x={0} y={0} width={w} height={h} rx={7} fill="rgba(244, 63, 94, 0.09)" style={anim("cw-fade", 500, delay)} />
        <rect
          x={0} y={0} width={w} height={h} rx={7}
          fill="none" stroke="#e11d48" strokeWidth={2.5} strokeDasharray="1" strokeDashoffset="1" pathLength={1}
          style={anim("cw-draw", 750, delay)}
        />
      </svg>

      {/* Pulsing red exclamation badge on the corner */}
      <div className="absolute" style={{ left: x >= 30 ? x - 28 : x - 12, top: x >= 30 ? y + h / 2 - 12 : y - 12, width: 24, height: 24 }}>
        <span className="absolute inset-0 rounded-full bg-rose-500" style={anim("cw-ping", 1400, delay + 500, `cw-ping 1600ms ease-out ${delay + 1900}ms infinite`)} />
        <span
          className="absolute inset-0 rounded-full bg-rose-600 text-snow text-[15px] font-black leading-6 text-center shadow-lg ring-2 ring-ink"
          style={anim("cw-pop", 500, delay + 350)}
        >
          !
        </span>
      </div>

      {chip && (
        <>
          {/* Arrow from the callout to the highlight */}
          <svg className="absolute inset-0 overflow-visible" width="100%" height="100%">
            <path
              d={`M${from[0]},${from[1]} Q${ctrl[0]},${ctrl[1]} ${to[0]},${to[1]}`}
              fill="none" stroke="#e11d48" strokeWidth={2.5} strokeLinecap="round"
              strokeDasharray="1" strokeDashoffset="1" pathLength={1}
              style={anim("cw-draw", 500, arrowDelay)}
            />
            <polyline
              points={`${head(0.5)} ${to[0]},${to[1]} ${head(-0.5)}`}
              fill="none" stroke="#e11d48" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
              style={anim("cw-fade", 150, arrowDelay + 450)}
            />
          </svg>

          {/* Callout chip */}
          <div className="absolute" style={{ left: chipX, top: chipY, ...anim("cw-fade-up", 400, arrowDelay - 150) }}>
            <div
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-rose-600 pl-1.5 pr-3 text-[11px] font-bold text-snow shadow-lift"
              style={{ height: ch, animation: `cw-nudge 2.4s ease-in-out ${arrowDelay + 600}ms infinite` }}
            >
              <span className="w-4 h-4 rounded-full bg-ink text-rose-600 text-[11px] font-black leading-4 text-center">!</span>
              {label}
            </div>
          </div>
        </>
      )}
    </>
  );
}
