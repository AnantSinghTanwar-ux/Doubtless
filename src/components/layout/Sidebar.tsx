"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import Logo from "@/components/landing/Logo";
import { isActive, useNavGroups } from "./nav";

export default function Sidebar() {
  const pathname = usePathname();
  const { user, profile, logout } = useAuth();
  const { groups, isAdmin } = useNavGroups();
  const name = profile?.displayName ?? user?.email ?? "";

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-line bg-sunk lg:flex">
      <div className="px-5 pb-4 pt-6">
        <Link href={profile?.role === "teacher" ? "/teacher-dashboard" : "/dashboard"} className="flex items-center gap-3">
          <Logo size={36} />
          <span className="font-display text-xl font-semibold tracking-tight text-ink">Ωlvε</span>
        </Link>
      </div>

      <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {groups.map((group, gi) => (
          <div key={group.label ?? gi}>
            {group.label && <p className="mb-1.5 px-3 text-xs font-medium text-faint">{group.label}</p>}
            <ul className="space-y-0.5">
              {group.links.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active ? "bg-sheet text-ink shadow-sheet ring-1 ring-line" : "text-muted hover:bg-ink/[0.05] hover:text-ink"
                      )}
                    >
                      {active && <span aria-hidden className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r bg-pen" />}
                      <link.icon className={cn("h-[18px] w-[18px]", active ? "text-pen" : "text-faint")} aria-hidden />
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 px-3 py-2">
          {profile?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.photoURL} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-line" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-semibold text-snow">
              {name.charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{name}</p>
            <p className="text-xs capitalize text-faint">{profile?.role ?? (isAdmin ? "admin" : "")}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-margin/10 hover:text-margin"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </button>
      </div>
    </aside>
  );
}
