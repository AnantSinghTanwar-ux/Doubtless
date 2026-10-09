"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

import { 
  LayoutDashboard, 
  Library, 
  MessageSquare, 
  PenTool, 
  Mic, 
  Target, 
  Dumbbell, 
  FileText, 
  Users, 
  Briefcase 
} from "lucide-react";

const studentLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vault", label: "Study Vault", icon: Library },
  { href: "/ask", label: "Ask Doubt", icon: MessageSquare },
  { href: "/solve", label: "Solve", icon: PenTool },
  { href: "/voice", label: "Voice", icon: Mic },
  { href: "/viva", label: "Viva", icon: Target },
  { href: "/practice", label: "Practice", icon: Dumbbell },
  { href: "/sample-paper", label: "Sample Paper", icon: FileText },
  { href: "/cowork", label: "CoWork", icon: Briefcase },
  { href: "/teachers", label: "Teachers", icon: Users },
];

const teacherLinks = [
  { href: "/teacher-dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/teachers", label: "Teachers", icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { profile, logout } = useAuth();
  const links = profile?.role === "teacher" ? teacherLinks : studentLinks;

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen bg-[#060b18]/80 border-r border-white/[0.06] backdrop-blur-xl fixed left-0 top-0 z-40">
      <div className="p-6 border-b border-white/[0.06]">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/30">
            D
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Doubtless</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">AI Education OS</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
              pathname === link.href
                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            <link.icon className="w-5 h-5" />
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 py-3 mb-2">
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
              {profile?.displayName?.charAt(0) ?? "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{profile?.displayName}</p>
            <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-red-400 hover:bg-red-400/5 transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
