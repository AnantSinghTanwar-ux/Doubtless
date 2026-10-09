"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Home", icon: "📊" },
  { href: "/ask", label: "Ask", icon: "❓" },
  { href: "/vault", label: "Vault", icon: "📚" },
  { href: "/solve", label: "Solve", icon: "✏️" },
  { href: "/voice", label: "Voice", icon: "🎙️" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#060b18]/95 backdrop-blur-xl border-t border-white/[0.06] safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[60px]",
              pathname === link.href
                ? "text-blue-400"
                : "text-gray-500 hover:text-gray-300"
            )}
          >
            <span className="text-xl">{link.icon}</span>
            <span className="text-[10px] font-medium">{link.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
