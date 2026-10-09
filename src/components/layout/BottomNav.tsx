"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut, MessageSquare, Library, PenTool, Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { isActive, useNavGroups } from "./nav";

const primary = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/ask", label: "Ask", icon: MessageSquare },
  { href: "/vault", label: "Vault", icon: Library },
  { href: "/solve", label: "Solve", icon: PenTool },
];

const tab = "flex min-w-[60px] flex-1 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors";

export default function BottomNav() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { groups } = useNavGroups();
  const [open, setOpen] = useState(false);
  const inPrimary = primary.some((l) => isActive(pathname, l.href));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fade-in absolute inset-0 bg-ink/45" onClick={() => setOpen(false)} />
          <div role="dialog" aria-label="All pages" className="slide-up absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-line bg-sheet p-4 pb-6">
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="font-display text-lg font-semibold text-ink">All pages</p>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-2 text-faint hover:bg-ink/[0.06] hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            {groups.map((group, gi) => (
              <div key={group.label ?? gi} className="mb-3">
                {group.label && <p className="mb-1 px-1 text-xs font-medium text-faint">{group.label}</p>}
                <div className="grid grid-cols-2 gap-2">
                  {group.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border px-3 py-3 text-sm font-medium",
                        isActive(pathname, link.href) ? "border-pen/40 bg-pen-wash text-pen-deep" : "border-line text-ink hover:bg-ink/[0.04]"
                      )}
                    >
                      <link.icon className="h-4 w-4 shrink-0" aria-hidden />
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={logout} className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-line px-3 py-3 text-sm text-muted hover:text-margin">
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          </div>
        </div>
      )}

      <nav aria-label="Main" className="safe-area-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-sunk/95 backdrop-blur lg:hidden">
        <div className="flex items-stretch justify-around px-2 py-1.5">
          {primary.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={cn(tab, active ? "text-pen" : "text-muted hover:text-ink")}>
                <link.icon className="h-5 w-5" aria-hidden />
                {link.label}
              </Link>
            );
          })}
          <button onClick={() => setOpen(true)} aria-haspopup="dialog" className={cn(tab, !inPrimary ? "text-pen" : "text-muted hover:text-ink")}>
            <Menu className="h-5 w-5" aria-hidden />
            More
          </button>
        </div>
      </nav>
    </>
  );
}
