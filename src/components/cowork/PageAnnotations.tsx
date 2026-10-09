"use client";

import type { CSSProperties } from "react";
import type { PageHighlight } from "@/types/cowork";

interface PageAnnotationsProps {
  highlights: PageHighlight[];
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

/**
 * Animated callouts drawn over a PDF page: marker sweeps, outlined boxes,
 * a pulsing red "!" and an arrow pointing at the most exam-relevant lines.
 * Mount it when the page scrolls into view; remounting replays the animation.
 */
export default function PageAnnotations({ highlights, width: W, height: H }: PageAnnotationsProps) {
  return (
    <div className="cw-anim absolute inset-0 pointer-events-none">
      {highlights.map((h, i) => {
        const [ymin, xmin, ymax, xmax] = h.box;
        const x = (xmin / 1000) * W - PAD;
        const y = (ymin / 1000) * H - PAD;
        const w = ((xmax - xmin) / 1000) * W + PAD * 2;
        const hh = ((ymax - ymin) / 1000) * H + PAD * 2;
        const delay = 250 + i * STAGGER;
        const style = TAG_STYLE[h.kind];
        const label = h.label || style.fallback;
        return h.kind === "important" ? (
          <ImportantCallout key={i} x={x} y={y} w={w} h={hh} W={W} label={label} delay={delay} />
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
            <span
              className="absolute whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide shadow-md"
              style={{
                left: Math.max(2, Math.min(x + w - chipWidth(label) + 30, W - chipWidth(label))),
                top: Math.max(2, y - 20),
                background: style.bg,
                color: style.text,
                ...anim("cw-fade-up", 400, delay + 450),
              }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ImportantCallout({ x, y, w, h, W, label, delay }: { x: number; y: number; w: number; h: number; W: number; label: string; delay: number }) {
  const cw = chipWidth(label);
  const ch = 26;

  // Place the callout chip to the right of the box if there's room, else above, else below.
  let chipX: number, chipY: number, from: [number, number], to: [number, number], ctrl: [number, number];
  if (x + w + 56 + cw < W) {
    chipX = x + w + 56;
    chipY = Math.max(4, y - 30);
    from = [chipX - 4, chipY + ch / 2];
    to = [x + w + 6, y + Math.min(h / 2, 16)];
    ctrl = [from[0] - 10, to[1]];
  } else if (y > 56) {
    chipX = Math.min(Math.max(4, x + 24), W - cw - 4);
    chipY = y - 54;
    from = [chipX + 22, chipY + ch + 3];
    to = [chipX + 46, y - 5];
    ctrl = [from[0] - 4, to[1] - 4];
  } else {
    chipX = Math.min(Math.max(4, x + 24), W - cw - 4);
    chipY = y + h + 30;
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
      <div className="absolute" style={{ left: x - 12, top: y - 12, width: 24, height: 24 }}>
        <span className="absolute inset-0 rounded-full bg-rose-500" style={anim("cw-ping", 1400, delay + 500, `cw-ping 1600ms ease-out ${delay + 1900}ms infinite`)} />
        <span
          className="absolute inset-0 rounded-full bg-rose-600 text-snow text-[15px] font-black leading-6 text-center shadow-lg ring-2 ring-ink"
          style={anim("cw-pop", 500, delay + 350)}
        >
          !
        </span>
      </div>

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
  );
}
