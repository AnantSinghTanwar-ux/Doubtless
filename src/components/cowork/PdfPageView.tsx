"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "@/lib/pdfClient";
import type { PageHighlight } from "@/types/cowork";
import PageAnnotations from "./PageAnnotations";

interface PdfPageViewProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  /** Page height / width at scale 1. */
  aspect: number;
  /** Rendered CSS width in px. */
  width: number;
  isActive: boolean;
  isAnalyzing: boolean;
  highlights: PageHighlight[];
  scrollRoot: HTMLElement | null;
}

function PdfPageView({ pdf, pageNumber, aspect, width, isActive, isAnalyzing, highlights, scrollRoot }: PdfPageViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [keep, setKeep] = useState(false);
  const [inView, setInView] = useState(false);
  const [rendered, setRendered] = useState(false);
  const renderedWidth = useRef(0);
  const [words, setWords] = useState<[number, number, number, number][] | null>(null);
  const height = width * aspect;

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || !scrollRoot) return;
    // Draw pages about a screen ahead; drop their pixels only once they are far away (large PDFs would otherwise use
    // GBs of memory). The gap between the two means scrolling back a little never has to redraw.
    const near = new IntersectionObserver(([entry]) => setNearViewport(entry.isIntersecting), { root: scrollRoot, rootMargin: "900px 0px" });
    const far = new IntersectionObserver(([entry]) => setKeep(entry.isIntersecting), { root: scrollRoot, rootMargin: "3500px 0px" });
    // Annotations mount when the page is genuinely on screen, so their animation plays as you scroll to it.
    const visible = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      root: scrollRoot,
      threshold: 0.35,
    });
    near.observe(el);
    far.observe(el);
    visible.observe(el);
    return () => {
      near.disconnect();
      far.disconnect();
      visible.disconnect();
    };
  }, [scrollRoot]);

  // Where the words are, so highlight labels can avoid covering them. Read once, when there is something to label.
  const wantWords = inView && highlights.length > 0 && words === null;
  useEffect(() => {
    if (!wantWords) return;
    let alive = true;
    (async () => {
      const lib = await import("@/lib/pdfClient");
      const boxes = await lib.textBoxes(await pdf.getPage(pageNumber)).catch(() => []);
      if (alive) setWords(boxes);
    })();
    return () => {
      alive = false;
    };
  }, [wantWords, pdf, pageNumber]);

  // Far away: free the canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (keep || !canvas) return;
    canvas.width = 0;
    canvas.height = 0;
    renderedWidth.current = 0;
    setRendered(false);
  }, [keep]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !nearViewport || width <= 0 || renderedWidth.current === width) return;

    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;

    // Wait a beat before drawing: a page that flies past during a fast scroll is never drawn at all.
    const delay = setTimeout(async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      // Above 2x the extra pixels aren't visible, but cost a lot of drawing time.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (width / base.width) * dpr });
      // Render offscreen first so a re-render (e.g. on resize) never flashes a blank page.
      const off = document.createElement("canvas");
      off.width = Math.floor(viewport.width);
      off.height = Math.floor(viewport.height);
      task = page.render({ canvasContext: off.getContext("2d")!, viewport });
      try {
        await task.promise;
      } catch {
        return; // cancelled
      }
      if (cancelled) return;
      canvas.width = off.width;
      canvas.height = off.height;
      canvas.getContext("2d")!.drawImage(off, 0, 0);
      renderedWidth.current = width;
      setRendered(true);
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(delay);
      task?.cancel();
    };
  }, [pdf, pageNumber, width, nearViewport]);

  return (
    <div
      ref={wrapperRef}
      className={`relative mx-auto bg-ink rounded-sm transition-shadow duration-300 ${
        isActive ? "shadow-lift" : "shadow-lift"
      }`}
      style={{ width, height }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full rounded-sm" />
      {!rendered && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
          <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-blue-500 animate-spin" />
        </div>
      )}
      {rendered && inView && highlights.length > 0 && words !== null && <PageAnnotations highlights={highlights} textBoxes={words} width={width} height={height} />}
      {rendered && isAnalyzing && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-sm">
          <div className="cw-scan absolute inset-x-0 h-28 bg-gradient-to-b from-transparent via-pen/20 to-transparent" />
          <span className="absolute top-3 right-3 rounded-full bg-slate-900/85 px-2.5 py-1 text-[11px] font-medium text-pen-deep backdrop-blur">
            Finding key points…
          </span>
        </div>
      )}
    </div>
  );
}

/** Memoised: the reader holds one per PDF page, and only pages whose props change should re-render. */
export default memo(PdfPageView);
