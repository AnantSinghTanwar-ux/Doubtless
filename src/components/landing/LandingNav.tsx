"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, Sparkles, X } from "lucide-react";
import Logo from "./Logo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const LINKS = [
  { id: "top", label: "Home" },
  { id: "features", label: "Features" },
  { id: "how", label: "How it works" },
  { id: "teachers", label: "Teachers" },
];

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Starts as a flat bar across the page. While scrolling it lifts off the edges, rounds into a floating,
 * slightly narrower pill and blurs the page behind it.
 */
export default function LandingNav() {
  const { user } = useAuth();
  const [p, setP] = useState(0);
  const [active, setActive] = useState("top");
  const [open, setOpen] = useState(false);
  const frame = useRef(0);

  useEffect(() => {
    const update = () => {
      frame.current = 0;
      setP(clamp(window.scrollY / 140));
      let current = "top";
      for (const l of LINKS) {
        const el = document.getElementById(l.id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.4) current = l.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame.current) frame.current = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame.current);
    };
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50" style={{ paddingInline: p * 24, paddingTop: p * 12, transition: "padding 160ms ease-out" }}>
      <div
        className="mx-auto"
        style={{
          maxWidth: 1240 - p * 140,
          paddingInline: 24 - p * 6,
          paddingBlock: 18 - p * 8,
          borderRadius: p * 40,
          background: `rgba(12, 12, 16, ${p * 0.72})`,
          border: `1px solid rgba(255, 255, 255, ${p * 0.1})`,
          backdropFilter: `blur(${p * 18}px)`,
          WebkitBackdropFilter: `blur(${p * 18}px)`,
          boxShadow: `0 12px 50px -14px rgba(154, 95, 150, ${p * 0.4})`,
          transition: "all 160ms ease-out",
        }}
      >
        <div className="flex items-center justify-between gap-6">
          <a href="#top" className="lp-drop flex items-center gap-3" style={{ animationDelay: "0.05s" }}>
            <Logo size={44 - p * 8} />
            <span className="font-display text-2xl font-semibold tracking-tight text-white">Doubtless</span>
          </a>

          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((l, i) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                className={cn("lp-drop relative rounded-full px-4 py-2 text-[15px] transition-colors", active === l.id ? "text-violet-300" : "text-zinc-400 hover:text-white")}
                style={{ animationDelay: `${0.15 + i * 0.08}s`, marginInline: -p * 2 }}
              >
                {l.label}
                <span
                  className={cn("absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-violet-400 transition-all duration-300", active === l.id ? "scale-100 opacity-100" : "scale-0 opacity-0")}
                />
              </a>
            ))}
          </nav>

          <div className="lp-drop hidden items-center gap-2 md:flex" style={{ animationDelay: "0.5s" }}>
            {user ? (
              <Link href="/login" className="rounded-full px-4 py-2 text-[15px] text-zinc-300 transition-colors hover:text-white">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="rounded-full px-4 py-2 text-[15px] text-zinc-300 transition-colors hover:text-white">
                  Log in
                </Link>
                <Link
                  href="/login"
                  className="btn-sheen flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[15px] font-semibold text-zinc-950 shadow-[0_8px_30px_-10px_rgba(255,255,255,0.35)] transition-transform hover:scale-[1.04]"
                >
                  <Sparkles className="h-4 w-4" /> Get started
                </Link>
              </>
            )}
          </div>

          <button onClick={() => setOpen((o) => !o)} className="rounded-lg p-2 text-zinc-300 md:hidden" aria-label="Menu">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        <div className={cn("grid transition-all duration-300 md:hidden", open ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
          <div className="overflow-hidden">
            <div className="flex flex-col gap-1 border-t border-white/10 pt-4">
              {LINKS.map((l) => (
                <a key={l.id} href={`#${l.id}`} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-zinc-300 hover:bg-white/5">
                  {l.label}
                </a>
              ))}
              <Link href="/login" className="mt-2 rounded-full bg-white px-5 py-3 text-center font-semibold text-zinc-950 shadow-[0_8px_30px_-10px_rgba(255,255,255,0.35)]">
                {user ? "Dashboard" : "Get started"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
