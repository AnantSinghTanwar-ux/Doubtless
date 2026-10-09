"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  Folder,
  Link2,
  Link2Off,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  LayoutList,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getVaultFolders, getVaultDocuments } from "@/lib/firestore";
import type { VaultFolder, VaultDocument } from "@/types";
import type { PDFDocumentProxy } from "@/lib/pdfClient";
import type { DocumentOverview, OverviewPageInput } from "@/types/cowork";
import PdfPageView from "@/components/cowork/PdfPageView";
import StudyPage, { type AnalysisState } from "@/components/cowork/StudyPage";
import OverviewPanel, { type OverviewState } from "@/components/cowork/OverviewPanel";

export default function CoWorkPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [vaults, setVaults] = useState<VaultDocument[]>([]);
  const [selectedVault, setSelectedVault] = useState<VaultDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [f, d] = await Promise.all([getVaultFolders(user.uid), getVaultDocuments(user.uid)]);
        setFolders(f);
        // Past papers aren't read like textbooks — they only feed the PYQ section.
        setVaults(d.filter((doc) => doc.type !== "paper"));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (!user) return null;

  if (selectedVault) {
    return <Reader vault={selectedVault} onExit={() => setSelectedVault(null)} />;
  }

  const groups = [
    ...folders.map((f) => ({ id: f.id, name: f.name, docs: vaults.filter((v) => v.folderId === f.id) })),
    { id: "_none", name: "Uncategorized", docs: vaults.filter((v) => !v.folderId) },
  ].filter((g) => g.docs.length > 0);

  return (
    <div className="min-h-[100dvh] bg-transparent">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </button>

        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-1 text-xs font-medium text-blue-300 mb-4">
            <Sparkles className="w-3.5 h-3.5" /> CoWork mode
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">Read with an AI study partner</h1>
          <p className="text-slate-400 mt-3 max-w-2xl leading-relaxed">
            Pick a textbook or notes PDF. Every page gets its own summary, key points, practice questions and PYQs —
            and the notes scroll along with the PDF as you read.
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 py-20 text-center">
            <FileText className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">No textbooks or notes yet</p>
            <p className="text-sm text-slate-500 mt-1">Upload a PDF in your Study Vault to start a CoWork session.</p>
            <button
              onClick={() => router.push("/vault")}
              className="mt-6 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              Go to Study Vault
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {groups.map((group) => (
              <section key={group.id}>
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-4">
                  <Folder className="w-3.5 h-3.5" /> {group.name}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.docs.map((vault) => (
                    <button
                      key={vault.id}
                      onClick={() => setSelectedVault(vault)}
                      className="group text-left rounded-xl border border-white/[0.07] bg-[#0e0e12] hover:border-blue-500/40 hover:bg-[#101014] p-4 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-12 shrink-0 rounded-md bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center">
                          <FileText className="w-4 h-4 text-blue-300" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-blue-100">
                            {vault.fileName || "Untitled document"}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">{vault.pageCount} pages</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reader: PDF on the left, one dedicated study page per PDF page on   */
/* the right, with scroll positions kept in sync in both directions.   */
/* ------------------------------------------------------------------ */

type Side = "pdf" | "notes";
type ScrollPos = { index: number; frac: number; atStart: boolean; atEnd: boolean };

// The "reading line" sits this far down the viewport; the page crossing it is the current page.
const ANCHOR = 0.3;
const ZOOMS = [0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5];
const CACHE_PREFIX = "cowork:v3";
const MAX_PARALLEL = 3;
// Pages with at least this much text-layer text are sent to the overview as text; others as an image.
const TEXT_PAGE_MIN_CHARS = 120;

const NO_HIGHLIGHTS: never[] = [];

function contentOffset(container: HTMLElement, el: HTMLElement) {
  return el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
}

function readPos(container: HTMLElement, els: HTMLElement[]): ScrollPos | null {
  if (!els.length || container.clientHeight === 0) return null;
  const line = container.scrollTop + container.clientHeight * ANCHOR;
  let index = 0;
  for (let i = 0; i < els.length; i++) {
    if (contentOffset(container, els[i]) <= line) index = i;
    else break;
  }
  const top = contentOffset(container, els[index]);
  const h = els[index].offsetHeight || 1;
  return {
    index,
    frac: Math.min(1, Math.max(0, (line - top) / h)),
    atStart: container.scrollTop <= 1,
    atEnd: container.scrollTop + container.clientHeight >= container.scrollHeight - 1,
  };
}

function writePos(container: HTMLElement, els: HTMLElement[], pos: ScrollPos) {
  if (!els[pos.index] || container.clientHeight === 0) return;
  let target: number;
  if (pos.atStart) target = 0;
  else if (pos.atEnd) target = container.scrollHeight;
  else {
    const el = els[pos.index];
    target = contentOffset(container, el) + pos.frac * el.offsetHeight - container.clientHeight * ANCHOR;
  }
  container.scrollTop = target;
}

function readCache(key: string): AnalysisState | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { status: "done", data: JSON.parse(raw) } : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(key: string, data: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

function Reader({ vault, onExit }: { vault: VaultDocument; onExit: () => void }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [aspects, setAspects] = useState<number[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [synced, setSynced] = useState(true);
  const [zoomIdx, setZoomIdx] = useState(ZOOMS.indexOf(1));
  const [mobileView, setMobileView] = useState<Side>("pdf");
  const [pdfPaneWidth, setPdfPaneWidth] = useState(0);
  const [notesPaneHeight, setNotesPaneHeight] = useState(0);
  const [analyses, setAnalyses] = useState<Record<number, AnalysisState>>({});
  const [notesTab, setNotesTab] = useState<"overview" | "pages">("overview");
  const [overview, setOverview] = useState<OverviewState>({ status: "idle" });

  const pdfPaneRef = useRef<HTMLDivElement>(null);
  const notesPaneRef = useRef<HTMLDivElement>(null);
  const pdfPageEls = useRef<HTMLElement[]>([]);
  const notePageEls = useRef<HTMLElement[]>([]);
  const driver = useRef<Side>("pdf");
  const lastPos = useRef<ScrollPos | null>(null);
  const frame = useRef<number | null>(null);
  const pageTexts = useRef<Map<number, string>>(new Map());
  const overviewStarted = useRef(false);
  const inFlight = useRef<Set<number>>(new Set());
  const notesTabRef = useRef(notesTab);
  const pdfLib = useRef<typeof import("@/lib/pdfClient") | null>(null);

  const numPages = aspects.length;

  // Load the PDF and every page's aspect ratio so placeholders have the right size up front.
  useEffect(() => {
    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const lib = await import("@/lib/pdfClient");
        pdfLib.current = lib;
        doc = await lib.loadPdf(`/uploads/${vault.id}.pdf`);
        const pages = await Promise.all(Array.from({ length: doc.numPages }, (_, i) => doc!.getPage(i + 1)));
        if (cancelled) return;
        setAspects(pages.map((p) => {
          const v = p.getViewport({ scale: 1 });
          return v.height / v.width;
        }));
        setPdf(doc);
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoadError("We couldn't open this PDF. It may have been uploaded before CoWork stored files — try re-uploading it.");
      }
    })();
    return () => {
      cancelled = true;
      doc?.destroy();
    };
  }, [vault.id]);

  // Track pane sizes: PDF width drives page rendering, notes height sizes each study page.
  useLayoutEffect(() => {
    const pdfEl = pdfPaneRef.current;
    const notesEl = notesPaneRef.current;
    if (!pdfEl || !notesEl) return;
    const ro = new ResizeObserver(() => {
      if (pdfEl.clientWidth) setPdfPaneWidth(pdfEl.clientWidth);
      if (notesEl.clientHeight) setNotesPaneHeight(notesEl.clientHeight);
    });
    ro.observe(pdfEl);
    ro.observe(notesEl);
    return () => ro.disconnect();
  }, [pdf]);

  const panes = useCallback(
    (side: Side) =>
      side === "pdf"
        ? { el: pdfPaneRef.current, items: pdfPageEls.current }
        : { el: notesPaneRef.current, items: notePageEls.current },
    []
  );

  /** Mirror the driver pane's reading position onto the other pane. */
  const syncFrom = useCallback(
    (source: Side) => {
      if (source === "notes" && notesTab !== "pages") return;
      const src = panes(source);
      if (!src.el) return;
      const pos = readPos(src.el, src.items);
      if (!pos) return;
      lastPos.current = pos;
      setCurrentPage(pos.index + 1);
      if (!synced || notesTab !== "pages") return;
      const dst = panes(source === "pdf" ? "notes" : "pdf");
      if (dst.el) writePos(dst.el, dst.items, pos);
    },
    [panes, synced, notesTab]
  );

  const onScroll = (side: Side) => () => {
    // Only the pane the user is interacting with drives; the follower's own scroll events are ignored.
    if (driver.current !== side) return;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => syncFrom(side));
  };

  const takeControl = (side: Side) => () => {
    driver.current = side;
  };

  // Content heights change as pages render and notes load; keep the follower aligned.
  useEffect(() => {
    const pdfEl = pdfPaneRef.current?.firstElementChild;
    const notesEl = notesPaneRef.current?.firstElementChild;
    if (!pdfEl || !notesEl) return;
    const ro = new ResizeObserver(() => {
      const pos = lastPos.current;
      if (!pos || !synced || notesTabRef.current !== "pages") return;
      const follower = panes(driver.current === "pdf" ? "notes" : "pdf");
      if (follower.el) writePos(follower.el, follower.items, pos);
    });
    ro.observe(pdfEl);
    ro.observe(notesEl);
    return () => ro.disconnect();
  }, [pdf, synced, panes]);

  // Re-align immediately when sync is switched back on.
  useEffect(() => {
    if (synced) syncFrom(driver.current);
  }, [synced, syncFrom]);

  // On mobile only one pane is visible; restore the shared position when switching.
  useEffect(() => {
    driver.current = mobileView;
    const pos = lastPos.current;
    const target = panes(mobileView);
    if (pos && target.el) requestAnimationFrame(() => writePos(target.el!, target.items, pos));
  }, [mobileView, panes]);

  const goToPage = useCallback(
    (page: number, side: Side = "pdf") => {
      const clamped = Math.min(Math.max(page, 1), numPages);
      const p = panes(side);
      const el = p.items[clamped - 1];
      if (!p.el || !el) return;
      driver.current = side;
      p.el.scrollTo({ top: contentOffset(p.el, el) - 16, behavior: "smooth" });
    },
    [numPages, panes]
  );

  // Keyboard: ←/→ or j/k move between pages.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowRight" || e.key === "j") goToPage(currentPage + 1, driver.current);
      if (e.key === "ArrowLeft" || e.key === "k") goToPage(currentPage - 1, driver.current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentPage, goToPage]);

  const getPageText = useCallback(
    async (page: number) => {
      const cached = pageTexts.current.get(page);
      if (cached !== undefined) return cached;
      const text = await pdfLib.current!.extractPageText(await pdf!.getPage(page));
      pageTexts.current.set(page, text);
      return text;
    },
    [pdf]
  );

  const analyze = useCallback(
    async (page: number, force = false) => {
      if (!pdf || page < 1 || page > numPages || inFlight.current.has(page)) return;
      const cacheKey = `${CACHE_PREFIX}:${vault.id}:${page}`;
      if (!force) {
        const cached = readCache(cacheKey);
        if (cached) {
          setAnalyses((a) => (a[page] ? a : { ...a, [page]: cached }));
          return;
        }
      }
      if (inFlight.current.size >= MAX_PARALLEL) return;

      inFlight.current.add(page);
      setAnalyses((a) => ({ ...a, [page]: { status: "loading" } }));
      try {
        // Send the rendered page: many slide decks draw text as vector shapes with no text layer.
        const pdfPage = await pdf.getPage(page);
        const [image, text] = await Promise.all([pdfLib.current!.renderPageImage(pdfPage, 1100, 0.82), getPageText(page)]);
        const res = await fetch("/api/cowork/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image, text }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        writeCache(cacheKey, data);
        setAnalyses((a) => ({ ...a, [page]: { status: "done", data } }));
      } catch (err) {
        console.error(err);
        setAnalyses((a) => ({ ...a, [page]: { status: "error", error: err instanceof Error ? err.message : "Unknown error" } }));
      } finally {
        inFlight.current.delete(page);
      }
    },
    [pdf, numPages, vault.id, getPageText]
  );

  // Analyze the page being read and prefetch the next two, so highlights are ready as you scroll.
  useEffect(() => {
    if (!pdf) return;
    for (const p of [currentPage, currentPage + 1, currentPage + 2]) {
      if (!analyses[p]) analyze(p);
    }
  }, [pdf, currentPage, analyses, analyze]);

  const buildOverview = useCallback(
    async (force = false) => {
      if (!pdf) return;
      try {
        if (!force) {
          const cached = await fetch(`/api/cowork/overview?vaultId=${vault.id}`);
          if (cached.ok) {
            setOverview({ status: "done", data: (await cached.json()) as DocumentOverview });
            return;
          }
        }
        const pages: OverviewPageInput[] = [];
        for (let p = 1; p <= numPages; p++) {
          setOverview({ status: "preparing", done: p, total: numPages });
          const text = await getPageText(p);
          if (text.replace(/\s/g, "").length >= TEXT_PAGE_MIN_CHARS) pages.push({ page: p, text });
          else pages.push({ page: p, image: await pdfLib.current!.renderPageImage(await pdf.getPage(p), 640, 0.6) });
        }
        setOverview({ status: "generating" });
        const res = await fetch("/api/cowork/overview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vaultId: vault.id, folderId: vault.folderId || null, pages, force }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        setOverview({ status: "done", data });
      } catch (err) {
        console.error(err);
        setOverview({ status: "error", error: err instanceof Error ? err.message : "Unknown error" });
      }
    },
    [pdf, numPages, vault.id, vault.folderId, getPageText]
  );

  useEffect(() => {
    if (!pdf || overviewStarted.current) return;
    overviewStarted.current = true;
    buildOverview();
  }, [pdf, buildOverview]);

  // Page notes are laid out fresh when that tab opens; line them up with the PDF.
  useEffect(() => {
    notesTabRef.current = notesTab;
    const notes = notesPaneRef.current;
    if (!notes) return;
    if (notesTab === "overview") {
      notes.scrollTop = 0;
      return;
    }
    const pos = lastPos.current;
    if (pos) requestAnimationFrame(() => writePos(notes, notePageEls.current, pos));
  }, [notesTab]);

  const zoom = ZOOMS[zoomIdx];
  const pageWidth = Math.max(0, Math.min(pdfPaneWidth - 48, 860) * zoom);
  const done = Object.values(analyses).filter((a) => a.status === "done").length;

  return (
    <div className="h-[100dvh] flex flex-col bg-transparent text-slate-200">
      {/* Top bar */}
      <header className="shrink-0 h-14 flex items-center gap-3 px-3 sm:px-4 border-b border-white/[0.06] bg-[#08080b]/90 backdrop-blur">
        <button
          onClick={onExit}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          aria-label="Back to documents"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-medium text-white truncate">{vault.fileName || "Untitled document"}</h1>
          <p className="text-[11px] text-slate-500">
            {numPages ? `${done} of ${numPages} pages analyzed` : "Loading…"}
          </p>
        </div>

        {numPages > 0 && (
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="flex items-center rounded-lg border border-white/[0.08] bg-white/[0.02]">
              <button
                onClick={() => goToPage(currentPage - 1, driver.current)}
                disabled={currentPage <= 1}
                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs tabular-nums text-slate-300 px-1 min-w-[4.5rem] text-center">
                {currentPage} / {numPages}
              </span>
              <button
                onClick={() => goToPage(currentPage + 1, driver.current)}
                disabled={currentPage >= numPages}
                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="hidden md:flex items-center rounded-lg border border-white/[0.08] bg-white/[0.02]">
              <button
                onClick={() => setZoomIdx((z) => Math.max(0, z - 1))}
                disabled={zoomIdx === 0}
                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30"
                aria-label="Zoom out"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-xs tabular-nums text-slate-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1))}
                disabled={zoomIdx === ZOOMS.length - 1}
                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30"
                aria-label="Zoom in"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setSynced((s) => !s)}
              className={`hidden lg:flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                synced
                  ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                  : "border-white/[0.08] bg-white/[0.02] text-slate-400 hover:text-white"
              }`}
              title={synced ? "Scrolling is linked — click to scroll panes independently" : "Link scrolling"}
            >
              {synced ? <Link2 className="w-3.5 h-3.5" /> : <Link2Off className="w-3.5 h-3.5" />}
              {synced ? "Synced" : "Unsynced"}
            </button>
          </div>
        )}
      </header>

      {/* Reading progress */}
      <div className="shrink-0 h-0.5 bg-white/[0.04]">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-violet-500 transition-[width] duration-300"
          style={{ width: numPages ? `${(currentPage / numPages) * 100}%` : 0 }}
        />
      </div>

      {/* Mobile pane switcher */}
      <div className="lg:hidden shrink-0 p-2 border-b border-white/[0.06]">
        <div className="grid grid-cols-2 rounded-lg bg-white/[0.04] p-1 text-sm">
          {(["pdf", "notes"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setMobileView(v)}
              className={`flex items-center justify-center gap-2 rounded-md py-1.5 transition-colors ${
                mobileView === v ? "bg-white/10 text-white" : "text-slate-400"
              }`}
            >
              {v === "pdf" ? <FileText className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
              {v === "pdf" ? "PDF" : "Notes"}
            </button>
          ))}
        </div>
      </div>

      {loadError ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3">
          <FileText className="w-8 h-8 text-slate-600" />
          <p className="text-slate-300 max-w-md">{loadError}</p>
          <button onClick={onExit} className="text-sm text-blue-400 hover:text-blue-300">
            Choose another document
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2">
          {/* PDF pane */}
          <div
            ref={pdfPaneRef}
            onScroll={onScroll("pdf")}
            onPointerEnter={takeControl("pdf")}
            onPointerDown={takeControl("pdf")}
            onTouchStart={takeControl("pdf")}
            onWheel={takeControl("pdf")}
            className={`min-h-0 overflow-auto bg-[#060608] lg:border-r border-white/[0.06] ${
              mobileView === "pdf" ? "block" : "hidden lg:block"
            }`}
          >
            <div className="py-6 px-6 space-y-6 w-max min-w-full">
              {!pdf && (
                <div className="flex justify-center py-32">
                  <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
                </div>
              )}
              {pdf &&
                pageWidth > 0 &&
                aspects.map((aspect, i) => (
                  <div
                    key={i}
                    ref={(el) => {
                      if (el) pdfPageEls.current[i] = el;
                    }}
                    className="flex flex-col items-center gap-2"
                  >
                    <PdfPageView
                      pdf={pdf}
                      pageNumber={i + 1}
                      aspect={aspect}
                      width={pageWidth}
                      isActive={currentPage === i + 1}
                      highlights={(() => {
                        const a = analyses[i + 1];
                        return a?.status === "done" ? a.data.highlights : NO_HIGHLIGHTS;
                      })()}
                      isAnalyzing={analyses[i + 1]?.status === "loading"}
                      scrollRoot={pdfPaneRef.current}
                    />
                    <span className="text-[11px] tabular-nums text-slate-600">{i + 1}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Notes pane: one dedicated study page per PDF page */}
          <div
            ref={notesPaneRef}
            onScroll={onScroll("notes")}
            onPointerEnter={takeControl("notes")}
            onPointerDown={takeControl("notes")}
            onTouchStart={takeControl("notes")}
            onWheel={takeControl("notes")}
            className={`min-h-0 overflow-y-auto ${mobileView === "notes" ? "block" : "hidden lg:block"}`}
          >
            <div className="max-w-3xl mx-auto px-3 sm:px-6 pb-6">
              <div className="sticky top-0 z-10 -mx-3 sm:-mx-6 px-3 sm:px-6 pt-4 pb-3 bg-[#08080b]/90 backdrop-blur">
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.04] border border-white/[0.06] p-1">
                  {(
                    [
                      { id: "overview", label: "Study guide", icon: <Sparkles className="w-4 h-4" />, hint: overview.status === "done" ? null : overview.status === "error" ? "!" : "…" },
                      { id: "pages", label: "Page by page", icon: <LayoutList className="w-4 h-4" />, hint: numPages ? `p.${currentPage}` : null },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setNotesTab(t.id)}
                      className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
                        notesTab === t.id ? "bg-white/10 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {t.icon}
                      {t.label}
                      {t.hint && <span className="text-[11px] font-normal text-slate-500 tabular-nums">{t.hint}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {notesTab === "overview" ? (
                <OverviewPanel
                  state={overview}
                  numPages={numPages}
                  onGoToPage={(p) => {
                    if (window.matchMedia("(max-width: 1023px)").matches) {
                      lastPos.current = { index: p - 1, frac: 0, atStart: false, atEnd: false };
                      setMobileView("pdf");
                    } else {
                      goToPage(p, "pdf");
                    }
                  }}
                  onRegenerate={() => buildOverview(true)}
                />
              ) : (
                <div className="space-y-6">
                  {aspects.map((_, i) => (
                    <div
                      key={i}
                      ref={(el) => {
                        if (el) notePageEls.current[i] = el;
                      }}
                    >
                      <StudyPage
                        pageNumber={i + 1}
                        totalPages={numPages}
                        state={analyses[i + 1]}
                        isActive={currentPage === i + 1}
                        minHeight={Math.max(320, notesPaneHeight - 120)}
                        onRetry={() => analyze(i + 1, true)}
                        onJumpToPdf={() => {
                          if (window.matchMedia("(max-width: 1023px)").matches) {
                            // The PDF pane is hidden on mobile; switching views restores lastPos.
                            lastPos.current = { index: i, frac: 0, atStart: false, atEnd: false };
                            setMobileView("pdf");
                          } else {
                            goToPage(i + 1, "pdf");
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
