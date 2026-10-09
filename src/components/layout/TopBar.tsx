"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useVault } from "@/contexts/VaultContext";
import { cn } from "@/lib/utils";
import Logo from "@/components/landing/Logo";

/** Sticky page header. Flat at the top; once the page scrolls it gains a blurred backing and a hairline. */
export default function TopBar({ title }: { title: string }) {
  const { profile } = useAuth();
  const { selectedVault } = useVault();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("sticky top-0 z-30 border-b transition-[background-color,border-color,box-shadow] duration-200", scrolled ? "border-line bg-paper/85 shadow-sheet backdrop-blur-md" : "border-transparent bg-transparent")}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="lg:hidden">
            <Logo size={32} />
          </span>
          <div className="min-w-0">
            <h1 className="display truncate text-2xl text-ink">{title}</h1>
            {selectedVault && (
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-pen" aria-hidden />
                <span className="truncate">Using {selectedVault.fileName}</span>
              </p>
            )}
          </div>
        </div>

        {profile?.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.photoURL} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-line lg:hidden" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-xs font-semibold text-snow lg:hidden">
            {profile?.displayName?.charAt(0).toUpperCase() ?? "?"}
          </div>
        )}
      </div>
    </header>
  );
}
