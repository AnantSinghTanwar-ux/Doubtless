"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import Logo from "./Logo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const LINKS = [
  { id: "features", label: "Features" },
  { id: "how", label: "How it works" },
  { id: "teachers", label: "Teachers" },
];

/** Transparent over the hero; picks up a paper backing and a hairline once the page scrolls. */
export default function LandingNav() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color] duration-200", scrolled || open ? "border-line bg-paper/90 backdrop-blur-md" : "border-transparent")}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3.5">
        <a href="#top" className="lp-drop flex items-center gap-2.5">
          <Logo size={34} />
          <span className="font-display text-xl font-semibold tracking-tight text-ink">Ωlvε</span>
        </a>

        <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a key={l.id} href={`#${l.id}`} className="rounded-lg px-3.5 py-2 text-[15px] text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Link href="/login" className="rounded-[10px] bg-ink px-4 py-2 text-[15px] font-medium text-snow transition-colors hover:bg-[#1f3159]">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-3.5 py-2 text-[15px] text-muted transition-colors hover:text-ink">
                Log in
              </Link>
              <Link href="/login" className="rounded-[10px] bg-ink px-4 py-2 text-[15px] font-medium text-snow transition-colors hover:bg-[#1f3159]">
                Get started
              </Link>
            </>
          )}
        </div>

        <button onClick={() => setOpen((o) => !o)} className="rounded-lg p-2 text-ink md:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-line px-6 pb-5 pt-3 md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <a key={l.id} href={`#${l.id}`} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-ink hover:bg-ink/[0.05]">
                {l.label}
              </a>
            ))}
            <Link href="/login" className="mt-2 rounded-[10px] bg-ink px-5 py-3 text-center font-medium text-snow">
              {user ? "Dashboard" : "Get started"}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
