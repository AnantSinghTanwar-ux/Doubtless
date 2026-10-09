"use client";

import { useEffect, useRef, useState } from "react";
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

export default function PdfPageView({ pdf, pageNumber, aspect, width, isActive, isAnalyzing, highlights, scrollRoot }: PdfPageViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [inView, setInView] = useState(false);
  const [rendered, setRendered] = useState(false);
  const height = width * aspect;

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || !scrollRoot) return;
    // Only keep canvases for pages near the viewport — large PDFs would otherwise use GBs of memory.
    const near = new IntersectionObserver(
      ([entry]) => {
        setNearViewport(entry.isIntersecting);
        if (!entry.isIntersecting) setRendered(false);
      },
      { root: scrollRoot, rootMargin: "1500px 0px" }
    );
    // Annotations mount when the page is genuinely on screen, so their animation plays as you scroll to it.
    const visible = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      root: scrollRoot,
      threshold: 0.35,
    });
    near.observe(el);
    visible.observe(el);
    return () => {
      near.disconnect();
      visible.disconnect();
    };
  }, [scrollRoot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!nearViewport || width <= 0) {
      canvas.width = 0;
      canvas.height = 0;
      return;
    }

    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;

    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
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
      setRendered(true);
    })();

    return () => {
      cancelled = true;
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
      {(!rendered || !nearViewport) && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
          <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-blue-500 animate-spin" />
        </div>
      )}
      {rendered && inView && highlights.length > 0 && <PageAnnotations highlights={highlights} width={width} height={height} />}
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
